'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { AlertType, DriverAlertWithRelations } from '@/lib/types/database'

export async function createAlert(
  driverId: string,
  shipmentId: string | null,
  alertType: AlertType,
  issue: string,
  customMessage?: string,
  latitude?: number | null,
  longitude?: number | null
) {
  const supabase = await createClient()

  if (!driverId || !alertType || !issue) {
    return { error: 'Driver ID, alert type, and issue are required' }
  }

  const { data, error } = await supabase
    .from('driver_alerts')
    .insert({
      driver_id: driverId,
      shipment_id: shipmentId,
      alert_type: alertType,
      issue,
      custom_message: customMessage || null,
      status: 'active',
      latitude: latitude || null,
      longitude: longitude || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating alert:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  
  return { success: true, alert: data }
}

export async function getRecentAlerts(limit: number = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('driver_alerts')
    .select(`
      *,
      drivers (*),
      shipments (*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching alerts:', error)
    return { error: error.message, alerts: [] }
  }

  return { alerts: data as DriverAlertWithRelations[] }
}

export async function getActiveAlerts() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('driver_alerts')
    .select(`
      *,
      drivers (*),
      shipments (*)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching active alerts:', error)
    return { error: error.message, alerts: [] }
  }

  return { alerts: data as DriverAlertWithRelations[] }
}

export async function updateAlertStatus(
  alertId: string,
  status: 'acknowledged' | 'resolved'
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('driver_alerts')
    .update({ status })
    .eq('id', alertId)

  if (error) {
    console.error('Error updating alert status:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  
  return { success: true }
}

export async function clearAllAlerts() {
  const supabase = await createClient()

  const { error } = await supabase
    .from('driver_alerts')
    .update({ status: 'resolved' })
    .eq('status', 'active')

  if (error) {
    console.error('Error clearing alerts:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  
  return { success: true }
}
