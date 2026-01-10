'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * API endpoint to sync vehicle and driver statuses with actual shipment data
 * This fixes any data inconsistencies where vehicles/drivers show as in_use/working
 * but don't have active shipments
 */
export async function POST() {
  try {
    // Get all vehicles that are currently "in_use"
    const { data: inUseVehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, license_plate, status')
      .eq('status', 'in_use')

    if (vehiclesError) {
      return NextResponse.json({ error: vehiclesError.message }, { status: 500 })
    }

    // Get all drivers that are currently "working"
    const { data: workingDrivers, error: driversError } = await supabase
      .from('drivers')
      .select('id, name, status')
      .eq('status', 'working')

    if (driversError) {
      return NextResponse.json({ error: driversError.message }, { status: 500 })
    }

    // Get all active shipments (in_transit only)
    const { data: activeShipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select('id, vehicle_id, driver_id, status')
      .eq('status', 'in_transit')

    if (shipmentsError) {
      return NextResponse.json({ error: shipmentsError.message }, { status: 500 })
    }

    // Create sets of vehicle and driver IDs that have active shipments
    const activeVehicleIds = new Set(activeShipments?.map(s => s.vehicle_id).filter(Boolean))
    const activeDriverIds = new Set(activeShipments?.map(s => s.driver_id).filter(Boolean))

    // Find vehicles marked as "in_use" but with no active shipment
    const vehiclesToFix = inUseVehicles?.filter(v => !activeVehicleIds.has(v.id)) || []
    
    // Find drivers marked as "working" but with no active shipment
    const driversToFix = workingDrivers?.filter(d => !activeDriverIds.has(d.id)) || []

    // Fix vehicles - set them to idle and clear route data
    const vehicleUpdates = []
    for (const vehicle of vehiclesToFix) {
      vehicleUpdates.push(
        supabase
          .from('vehicles')
          .update({ 
            status: 'idle',
            current_route: null,
            route_index: 0,
            eta: null,
          })
          .eq('id', vehicle.id)
      )
    }

    // Fix drivers - set them to idle
    const driverUpdates = []
    for (const driver of driversToFix) {
      driverUpdates.push(
        supabase
          .from('drivers')
          .update({ status: 'idle' })
          .eq('id', driver.id)
      )
    }

    await Promise.all([...vehicleUpdates, ...driverUpdates])

    return NextResponse.json({
      success: true,
      message: 'Status sync completed',
      stats: {
        activeShipments: activeShipments?.length || 0,
        vehiclesFixed: vehiclesToFix.length,
        driversFixed: driversToFix.length,
        vehiclesFixedDetails: vehiclesToFix.map(v => v.license_plate),
        driversFixedDetails: driversToFix.map(d => d.name),
      }
    })

  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to check current status without fixing
export async function GET() {
  try {
    const { data: inUseVehicles } = await supabase
      .from('vehicles')
      .select('id, license_plate, status')
      .eq('status', 'in_use')

    const { data: workingDrivers } = await supabase
      .from('drivers')
      .select('id, name, status')
      .eq('status', 'working')

    const { data: activeShipments } = await supabase
      .from('shipments')
      .select('id, shipment_number, vehicle_id, driver_id, status')
      .eq('status', 'in_transit')

    const activeVehicleIds = new Set(activeShipments?.map(s => s.vehicle_id).filter(Boolean))
    const activeDriverIds = new Set(activeShipments?.map(s => s.driver_id).filter(Boolean))

    const inconsistentVehicles = inUseVehicles?.filter(v => !activeVehicleIds.has(v.id)) || []
    const inconsistentDrivers = workingDrivers?.filter(d => !activeDriverIds.has(d.id)) || []

    return NextResponse.json({
      activeShipments: activeShipments?.length || 0,
      inUseVehicles: inUseVehicles?.length || 0,
      workingDrivers: workingDrivers?.length || 0,
      inconsistencies: {
        vehicles: inconsistentVehicles.map(v => v.license_plate),
        drivers: inconsistentDrivers.map(d => d.name),
      },
      needsSync: inconsistentVehicles.length > 0 || inconsistentDrivers.length > 0,
    })

  } catch (error) {
    console.error('Check status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
