'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Sync vehicle and driver statuses with actual shipment data
 * This fixes any data inconsistencies where vehicles/drivers show as in_use/working
 * but don't have active shipments
 */
export async function syncVehicleDriverStatuses() {
  const supabase = await createClient()

  // Get all vehicles that are currently "in_use"
  const { data: inUseVehicles } = await supabase
    .from('vehicles')
    .select('id, license_plate')
    .eq('status', 'in_use')

  // Get all drivers that are currently "working"
  const { data: workingDrivers } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('status', 'working')

  // Get all active shipments (in_transit only)
  const { data: activeShipments } = await supabase
    .from('shipments')
    .select('id, vehicle_id, driver_id')
    .eq('status', 'in_transit')

  // Create sets of vehicle and driver IDs that have active shipments
  const activeVehicleIds = new Set(activeShipments?.map(s => s.vehicle_id).filter(Boolean))
  const activeDriverIds = new Set(activeShipments?.map(s => s.driver_id).filter(Boolean))

  // Find vehicles marked as "in_use" but with no active shipment
  const vehiclesToFix = inUseVehicles?.filter(v => !activeVehicleIds.has(v.id)) || []
  
  // Find drivers marked as "working" but with no active shipment
  const driversToFix = workingDrivers?.filter(d => !activeDriverIds.has(d.id)) || []

  // Fix vehicles - set them to idle and clear route data
  for (const vehicle of vehiclesToFix) {
    await supabase
      .from('vehicles')
      .update({ 
        status: 'idle',
        current_route: null,
        route_index: 0,
        eta: null,
      })
      .eq('id', vehicle.id)
  }

  // Fix drivers - set them to idle
  for (const driver of driversToFix) {
    await supabase
      .from('drivers')
      .update({ status: 'idle' })
      .eq('id', driver.id)
  }

  revalidatePath('/dashboard')
  revalidatePath('/vehicles')
  revalidatePath('/drivers')
  revalidatePath('/shipments')
  revalidatePath('/fleetmap')

  return {
    success: true,
    vehiclesFixed: vehiclesToFix.length,
    driversFixed: driversToFix.length,
  }
}

export async function createVehicle(formData: FormData) {
  const supabase = await createClient()

  const type = formData.get('type') as string
  const licensePlate = formData.get('license_plate') as string

  if (!type || !licensePlate) {
    return { error: 'Type and license plate are required' }
  }

  const { error } = await supabase
    .from('vehicles')
    .insert({
      type,
      license_plate: licensePlate,
      status: 'idle',
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/vehicles')
  revalidatePath('/shipments')

  return { success: true }
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const supabase = await createClient()

  const type = formData.get('type') as string
  const licensePlate = formData.get('license_plate') as string

  if (!type || !licensePlate) {
    return { error: 'Type and license plate are required' }
  }

  const { error } = await supabase
    .from('vehicles')
    .update({
      type,
      license_plate: licensePlate,
    })
    .eq('id', vehicleId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/vehicles')
  revalidatePath('/shipments')

  return { success: true }
}

export async function deleteVehicle(vehicleId: string) {
  const supabase = await createClient()

  // Check if vehicle is currently in use
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('status')
    .eq('id', vehicleId)
    .single()

  if (vehicle?.status === 'in_use') {
    return { error: 'Cannot delete a vehicle that is currently in use' }
  }

  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', vehicleId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/vehicles')
  revalidatePath('/shipments')

  return { success: true }
}
