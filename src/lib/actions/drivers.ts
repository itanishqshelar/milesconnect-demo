'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createDriver(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string

  if (!name) {
    return { error: 'Name is required' }
  }

  const { error } = await supabase
    .from('drivers')
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      status: 'idle',
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/drivers')
  revalidatePath('/shipments')

  return { success: true }
}

export async function updateDriver(driverId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string

  if (!name) {
    return { error: 'Name is required' }
  }

  const { error } = await supabase
    .from('drivers')
    .update({
      name,
      email: email || null,
      phone: phone || null,
    })
    .eq('id', driverId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/drivers')
  revalidatePath('/shipments')

  return { success: true }
}

export async function deleteDriver(driverId: string) {
  const supabase = await createClient()

  // Check if driver is currently working
  const { data: driver } = await supabase
    .from('drivers')
    .select('status')
    .eq('id', driverId)
    .single()

  if (driver?.status === 'working') {
    return { error: 'Cannot delete a driver who is currently working' }
  }

  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', driverId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/drivers')
  revalidatePath('/shipments')

  return { success: true }
}
