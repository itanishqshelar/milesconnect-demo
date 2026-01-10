import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Vehicle, Shipment, RouteGeometry } from '@/lib/types/database'

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface VehicleWithShipment extends Vehicle {
  shipment?: Shipment | null
}

// Calculate distance between two points in km using Haversine formula
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Calculate remaining distance along route from current index
function calculateRemainingDistance(coordinates: [number, number][], fromIndex: number): number {
  let distance = 0
  for (let i = fromIndex; i < coordinates.length - 1; i++) {
    distance += haversineDistance(
      coordinates[i][1], coordinates[i][0],
      coordinates[i + 1][1], coordinates[i + 1][0]
    )
  }
  return distance
}

// Find next index to move to based on target distance (km)
function findNextIndex(coordinates: [number, number][], fromIndex: number, targetDistanceKm: number): number {
  let distance = 0
  let index = fromIndex
  
  while (index < coordinates.length - 1 && distance < targetDistanceKm) {
    distance += haversineDistance(
      coordinates[index][1], coordinates[index][0],
      coordinates[index + 1][1], coordinates[index + 1][0]
    )
    index++
  }
  
  return Math.min(index, coordinates.length - 1)
}

export async function POST() {
  try {
    // Fetch all vehicles that are in_use (have active shipments)
    // Skip vehicles in 'live' tracking mode - they're being tracked by the driver app
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'in_use')

    if (vehiclesError) {
      console.error('Vehicles query error:', vehiclesError)
      return NextResponse.json({ error: vehiclesError.message }, { status: 500 })
    }

    if (!vehicles || vehicles.length === 0) {
      return NextResponse.json({ message: 'No active vehicles to simulate', updated: 0 })
    }

    // Filter out vehicles in live tracking mode (if tracking_mode column exists)
    const simulatedVehicles = vehicles.filter(v => 
      !v.tracking_mode || v.tracking_mode === 'simulated'
    )

    if (simulatedVehicles.length === 0) {
      return NextResponse.json({ message: 'No simulated vehicles to update', updated: 0 })
    }

    // Fetch active shipments for these vehicles
    const vehicleIds = simulatedVehicles.map(v => v.id)
    const { data: shipments } = await supabase
      .from('shipments')
      .select('*')
      .eq('status', 'in_transit')
      .in('vehicle_id', vehicleIds)

    // Create a map of vehicle_id to shipment
    const shipmentMap = new Map<string, Shipment>()
    shipments?.forEach(s => {
      if (s.vehicle_id) {
        shipmentMap.set(s.vehicle_id, s)
      }
    })

    const updates: Promise<void>[] = []

    for (const vehicle of simulatedVehicles as VehicleWithShipment[]) {
      const shipment = shipmentMap.get(vehicle.id)
      
      if (!vehicle.current_route) {
        // Skip vehicles without a route
        continue
      }

      // Parse route data - handle both string and object formats
      let route: RouteGeometry
      if (typeof vehicle.current_route === 'string') {
        try {
          route = JSON.parse(vehicle.current_route) as RouteGeometry
        } catch {
          continue // Skip invalid route data
        }
      } else {
        route = vehicle.current_route as RouteGeometry
      }
      
      if (!route.coordinates || !Array.isArray(route.coordinates)) {
        continue
      }
      
      const coordinates = route.coordinates
      const currentIndex = vehicle.route_index || 0
      const totalPoints = coordinates.length

      // Calculate speed based on actual route data so vehicle arrives at real ETA
      // Use Mapbox's duration (in seconds) to determine how fast to move
      const updateIntervalSeconds = 3
      
      // Calculate how many points to move per update based on route duration
      // If route takes X seconds, and we update every 3 seconds, we need to move
      // (totalPoints / (duration / updateInterval)) points per update
      let pointsPerUpdate: number
      if (route.duration && route.duration > 0) {
        // Use actual Mapbox duration for realistic movement
        const totalUpdates = route.duration / updateIntervalSeconds
        pointsPerUpdate = Math.max(1, Math.ceil(totalPoints / totalUpdates))
      } else {
        // Fallback: assume 30 km/h average speed
        const distanceKm = (route.distance || 10000) / 1000
        const durationSeconds = (distanceKm / 30) * 3600
        const totalUpdates = durationSeconds / updateIntervalSeconds
        pointsPerUpdate = Math.max(1, Math.ceil(totalPoints / totalUpdates))
      }
      
      // Add slight randomness (±20%) for realistic variation
      const variation = 0.8 + Math.random() * 0.4
      const actualPointsToMove = Math.max(1, Math.round(pointsPerUpdate * variation))
      
      const nextIndex = Math.min(currentIndex + actualPointsToMove, coordinates.length - 1)

      if (nextIndex >= coordinates.length - 1) {
        // Vehicle has reached destination - mark shipment as delivered
        if (shipment) {
          updates.push(
            (async () => {
              // Update shipment to delivered
              await supabase
                .from('shipments')
                .update({ 
                  status: 'delivered',
                  delivered_at: new Date().toISOString()
                })
                .eq('id', shipment.id)

              // Update driver to idle
              if (shipment.driver_id) {
                await supabase
                  .from('drivers')
                  .update({ status: 'idle' })
                  .eq('id', shipment.driver_id)
              }

              // Update vehicle - set to destination and clear route
              await supabase
                .from('vehicles')
                .update({
                  latitude: coordinates[coordinates.length - 1][1],
                  longitude: coordinates[coordinates.length - 1][0],
                  status: 'idle',
                  current_route: null,
                  route_index: 0,
                  eta: null,
                  last_location_update: new Date().toISOString(),
                })
                .eq('id', vehicle.id)
            })()
          )
        }
      } else {
        // Vehicle is still en route - update position
        const newLng = coordinates[nextIndex][0]
        const newLat = coordinates[nextIndex][1]

        // Calculate ETA based on remaining portion of route and original duration
        const remainingRatio = (totalPoints - nextIndex) / totalPoints
        let remainingTimeMs: number
        
        if (route.duration && route.duration > 0) {
          // Use actual Mapbox duration for accurate ETA
          remainingTimeMs = route.duration * remainingRatio * 1000
        } else {
          // Fallback: estimate based on distance
          const remainingDistanceKm = calculateRemainingDistance(coordinates, nextIndex)
          const avgSpeedKmH = 30 // Conservative estimate
          remainingTimeMs = (remainingDistanceKm / avgSpeedKmH) * 3600 * 1000
        }
        
        const newEta = new Date(Date.now() + remainingTimeMs).toISOString()

        updates.push(
          (async () => {
            await supabase
              .from('vehicles')
              .update({
                latitude: newLat,
                longitude: newLng,
                route_index: nextIndex,
                eta: newEta,
                last_location_update: new Date().toISOString(),
              })
              .eq('id', vehicle.id)
          })()
        )
      }
    }

    await Promise.all(updates)

    return NextResponse.json({ 
      success: true, 
      updated: updates.length,
      message: `Updated ${updates.length} vehicles`
    })

  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// GET endpoint to check simulation status
export async function GET() {
  try {
    const { data: activeVehicles } = await supabase
      .from('vehicles')
      .select('id, license_plate, latitude, longitude, route_index, eta, status')
      .eq('status', 'in_use')

    return NextResponse.json({
      activeVehicles: activeVehicles?.length || 0,
      vehicles: activeVehicles || [],
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
