import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkPaymentStatusSaltKey } from '@/lib/phonepe/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * PhonePe Payment Callback (Redirect URL)
 * 
 * This endpoint is where PhonePe redirects after payment completion.
 * It checks the payment status and redirects to appropriate page.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shipmentId = searchParams.get('shipmentId')
    const transactionId = searchParams.get('transactionId')
    const status = searchParams.get('status') // For mock redirects

    if (!shipmentId) {
      return NextResponse.redirect(new URL('/customer/dashboard?error=missing_shipment', request.url))
    }

    // Get shipment
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('id, phonepe_order_id, payment_status, driver_id, vehicle_id')
      .eq('id', shipmentId)
      .single()

    if (fetchError || !shipment) {
      return NextResponse.redirect(new URL('/customer/dashboard?error=shipment_not_found', request.url))
    }

    // Check if already completed (webhook might have already processed it)
    if (shipment.payment_status === 'completed') {
      return NextResponse.redirect(new URL(`/customer/dashboard?payment=success`, request.url))
    }

    // For mock/demo redirects with status param
    if (status === 'SUCCESS' || transactionId) {
      // Update shipment as completed
      await supabase
        .from('shipments')
        .update({
          status: 'delivered',
          payment_status: 'completed',
          payment_transaction_id: transactionId || `TXN${Date.now()}`,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', shipmentId)

      // Reset driver and vehicle
      if (shipment.driver_id) {
        await supabase
          .from('drivers')
          .update({ status: 'idle' })
          .eq('id', shipment.driver_id)
      }

      if (shipment.vehicle_id) {
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

      return NextResponse.redirect(new URL(`/customer/dashboard?payment=success`, request.url))
    }

    // Check payment status with PhonePe
    const merchantTransactionId = shipment.phonepe_order_id
    if (merchantTransactionId) {
      const paymentStatus = await checkPaymentStatusSaltKey(merchantTransactionId)
      
      if (paymentStatus.state === 'SUCCESS') {
        // Update shipment
        await supabase
          .from('shipments')
          .update({
            status: 'delivered',
            payment_status: 'completed',
            payment_transaction_id: paymentStatus.transactionId,
            delivered_at: new Date().toISOString(),
          })
          .eq('id', shipmentId)

        // Reset driver and vehicle
        if (shipment.driver_id) {
          await supabase
            .from('drivers')
            .update({ status: 'idle' })
            .eq('id', shipment.driver_id)
        }

        if (shipment.vehicle_id) {
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

        return NextResponse.redirect(new URL(`/customer/dashboard?payment=success`, request.url))
      } else if (paymentStatus.state === 'FAILED') {
        await supabase
          .from('shipments')
          .update({ payment_status: 'failed' })
          .eq('id', shipmentId)

        return NextResponse.redirect(new URL(`/customer/dashboard?payment=failed`, request.url))
      }
    }

    // Payment still pending
    return NextResponse.redirect(new URL(`/customer/dashboard?payment=pending`, request.url))
  } catch (error) {
    console.error('Payment callback error:', error)
    return NextResponse.redirect(new URL('/customer/dashboard?error=callback_failed', request.url))
  }
}

/**
 * POST handler for PhonePe redirect (some flows use POST)
 */
export async function POST(request: Request) {
  // PhonePe might POST with form data, extract and redirect
  const formData = await request.formData()
  const shipmentId = formData.get('shipmentId') || new URL(request.url).searchParams.get('shipmentId')
  
  if (shipmentId) {
    // Redirect to GET handler with params
    const url = new URL(request.url)
    url.searchParams.set('shipmentId', shipmentId.toString())
    return GET(new Request(url.toString()))
  }
  
  return NextResponse.redirect(new URL('/customer/dashboard?error=invalid_callback', request.url))
}
