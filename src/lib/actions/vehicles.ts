'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
