'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ShipmentStatus } from '@/lib/types/database'
import { getOrCreateCustomer } from './customers'

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

  // Handle customer - either existing or new
  let customerId: string | null = null
  const existingCustomerId = formData.get('customer_id') as string
  const newCustomerName = formData.get('customer_name') as string
  const newCustomerPhone = formData.get('customer_phone') as string

  if (existingCustomerId) {
    // Using existing customer
    customerId = existingCustomerId
  } else if (newCustomerName && newCustomerPhone) {
    // Creating new customer
    const customerResult = await getOrCreateCustomer(newCustomerName, newCustomerPhone)
    if (customerResult.error) {
      return { error: customerResult.error }
    }
    customerId = customerResult.customer?.id || null
  }

  if (!customerId) {
    return { error: 'Customer information is required' }
  }

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
      customer_id: customerId,
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

/**
 * Generate 4-digit OTP for delivery verification
 */
function generateDeliveryOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * Driver arrives at destination - generates OTP for customer verification
 */
export async function markDriverArrived(shipmentId: string) {
  const supabase = await createClient()

  // Get the shipment first
  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('id, status')
    .eq('id', shipmentId)
    .single()

  if (fetchError || !shipment) {
    return { error: 'Shipment not found' }
  }

  if (shipment.status !== 'in_transit') {
    return { error: 'Shipment must be in transit to mark as arrived' }
  }

  // Generate 4-digit OTP
  const otp = generateDeliveryOTP()

  // Update shipment status to 'arrived' and store OTP
  const { error: updateError } = await supabase
    .from('shipments')
    .update({
      status: 'arrived',
      delivery_otp: otp,
      otp_generated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/shipments')
  revalidatePath('/driver/dashboard')

  return { success: true, otp }
}

/**
 * Verify OTP entered by driver (shared by customer)
 */
export async function verifyDeliveryOTP(shipmentId: string, enteredOtp: string) {
  const supabase = await createClient()

  // Get the shipment with OTP
  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('id, status, delivery_otp, otp_generated_at')
    .eq('id', shipmentId)
    .single()

  if (fetchError || !shipment) {
    return { error: 'Shipment not found' }
  }

  if (shipment.status !== 'arrived') {
    return { error: 'Shipment must be in arrived status' }
  }

  if (!shipment.delivery_otp) {
    return { error: 'No OTP generated for this shipment' }
  }

  // Check OTP expiry (10 minutes)
  if (shipment.otp_generated_at) {
    const otpAge = Date.now() - new Date(shipment.otp_generated_at).getTime()
    if (otpAge > 10 * 60 * 1000) {
      return { error: 'OTP has expired. Please regenerate.' }
    }
  }

  // Verify OTP
  if (shipment.delivery_otp !== enteredOtp) {
    return { error: 'Invalid OTP. Please check with the customer.' }
  }

  // Mark OTP as verified
  const { error: updateError } = await supabase
    .from('shipments')
    .update({
      otp_verified_at: new Date().toISOString(),
    })
    .eq('id', shipmentId)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/shipments')

  return { success: true }
}

/**
 * Regenerate OTP if expired or customer missed it
 */
export async function regenerateDeliveryOTP(shipmentId: string) {
  const supabase = await createClient()

  // Get the shipment
  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('id, status')
    .eq('id', shipmentId)
    .single()

  if (fetchError || !shipment) {
    return { error: 'Shipment not found' }
  }

  if (shipment.status !== 'arrived') {
    return { error: 'Shipment must be in arrived status' }
  }

  // Generate new OTP
  const otp = generateDeliveryOTP()

  const { error: updateError } = await supabase
    .from('shipments')
    .update({
      delivery_otp: otp,
      otp_generated_at: new Date().toISOString(),
      otp_verified_at: null, // Reset verification
    })
    .eq('id', shipmentId)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/shipments')

  return { success: true, otp }
}
