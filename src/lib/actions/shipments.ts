'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ShipmentStatus } from '@/lib/types/database'

function generateShipmentNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `MC-${date}-${random}`
}

export async function createShipment(formData: FormData) {
  const supabase = await createClient()

  const startLocation = formData.get('start_location') as string
  const destination = formData.get('destination') as string
  const startLat = parseFloat(formData.get('start_location_lat') as string) || null
  const startLng = parseFloat(formData.get('start_location_lng') as string) || null
  const destLat = parseFloat(formData.get('destination_lat') as string) || null
  const destLng = parseFloat(formData.get('destination_lng') as string) || null
  const driverId = formData.get('driver_id') as string
  const vehicleId = formData.get('vehicle_id') as string
  const revenue = parseFloat(formData.get('revenue') as string) || 0

  if (!startLocation || !destination || !driverId || !vehicleId) {
    return { error: 'All fields are required' }
  }

  if (!startLat || !startLng || !destLat || !destLng) {
    return { error: 'Please select valid locations from the dropdown' }
  }

  const shipmentNumber = generateShipmentNumber()

  // Fetch route from Mapbox Directions API with traffic data
  let routeData = null
  try {
    // Use driving-traffic profile for real-time traffic-aware routing
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${startLng},${startLat};${destLng},${destLat}?geometries=geojson&overview=full&annotations=congestion,duration&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
    const routeResponse = await fetch(directionsUrl)
    const routeJson = await routeResponse.json()
    
    if (routeJson.routes && routeJson.routes.length > 0) {
      const route = routeJson.routes[0]
      routeData = {
        coordinates: route.geometry.coordinates,
        duration: route.duration, // in seconds (with traffic)
        distance: route.distance, // in meters
        congestion: route.legs?.[0]?.annotation?.congestion || [], // Traffic congestion per segment
      }
    }
  } catch (error) {
    console.error('Failed to fetch route:', error)
  }

  // Create shipment
  const { error: shipmentError } = await supabase
    .from('shipments')
    .insert({
      shipment_number: shipmentNumber,
      start_location: startLocation,
      destination: destination,
      start_lat: startLat,
      start_lng: startLng,
      dest_lat: destLat,
      dest_lng: destLng,
      driver_id: driverId,
      vehicle_id: vehicleId,
      revenue: revenue,
      status: 'in_transit',
    })

  if (shipmentError) {
    return { error: shipmentError.message }
  }

  // Update driver status to 'working'
  await supabase
    .from('drivers')
    .update({ status: 'working' })
    .eq('id', driverId)

  // Update vehicle status to 'in_use' and set initial position + route
  const vehicleUpdate: {
    status: string
    latitude: number | null
    longitude: number | null
    current_route: typeof routeData
    route_index: number
    eta: string | null
  } = {
    status: 'in_use',
    latitude: startLat,
    longitude: startLng,
    current_route: routeData,
    route_index: 0,
    eta: routeData ? new Date(Date.now() + routeData.duration * 1000).toISOString() : null,
  }
  
  await supabase
    .from('vehicles')
    .update(vehicleUpdate)
    .eq('id', vehicleId)

  revalidatePath('/dashboard')
  revalidatePath('/shipments')
  revalidatePath('/drivers')
  revalidatePath('/vehicles')

  return { success: true, shipmentNumber }
}

export async function updateShipmentStatus(shipmentId: string, newStatus: ShipmentStatus) {
  const supabase = await createClient()

  // Get the shipment first to know driver and vehicle
  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('driver_id, vehicle_id, status')
    .eq('id', shipmentId)
    .single()

  if (fetchError || !shipment) {
    return { error: 'Shipment not found' }
  }

  // Update shipment status
  const updateData: { status: ShipmentStatus; delivered_at?: string } = { status: newStatus }
  if (newStatus === 'delivered') {
    updateData.delivered_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('shipments')
    .update(updateData)
    .eq('id', shipmentId)

  if (updateError) {
    return { error: updateError.message }
  }

  // If delivered or cancelled, set driver and vehicle back to idle
  if (newStatus === 'delivered' || newStatus === 'cancelled') {
    if (shipment.driver_id) {
      await supabase
        .from('drivers')
        .update({ status: 'idle' })
        .eq('id', shipment.driver_id)
    }

    if (shipment.vehicle_id) {
      // Clear vehicle location and route data when shipment ends
      await supabase
        .from('vehicles')
        .update({ 
          status: 'idle',
          current_route: null,
          route_index: 0,
          eta: null,
        })
        .eq('id', shipment.vehicle_id)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/shipments')
  revalidatePath('/drivers')
  revalidatePath('/vehicles')

  return { success: true }
}

export async function deleteShipment(shipmentId: string) {
  const supabase = await createClient()

  // Get the shipment first
  const { data: shipment } = await supabase
    .from('shipments')
    .select('driver_id, vehicle_id, status')
    .eq('id', shipmentId)
    .single()

  // Delete the shipment
  const { error } = await supabase
    .from('shipments')
    .delete()
    .eq('id', shipmentId)

  if (error) {
    return { error: error.message }
  }

  // If the shipment was in transit, free up driver and vehicle
  if (shipment && shipment.status === 'in_transit') {
    if (shipment.driver_id) {
      await supabase
        .from('drivers')
        .update({ status: 'idle' })
        .eq('id', shipment.driver_id)
    }

    if (shipment.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ status: 'idle' })
        .eq('id', shipment.vehicle_id)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/shipments')
  revalidatePath('/drivers')
  revalidatePath('/vehicles')

  return { success: true }
}
