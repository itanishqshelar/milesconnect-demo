import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateWebhookSignature, parseWebhookPayload, WebhookPayload } from '@/lib/phonepe/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PhonePe Webhook Handler
 * 
 * This endpoint receives callbacks from PhonePe when payment status changes.
 * Events: checkout.order.completed, checkout.order.failed
 */
export async function POST(request: Request) {
  try {
    // Validate webhook signature
    const authHeader = request.headers.get('authorization') || ''
    const webhookUsername = process.env.PHONEPE_WEBHOOK_USERNAME || ''
    const webhookPassword = process.env.PHONEPE_WEBHOOK_PASSWORD || ''

    // Skip validation in demo mode (when credentials not set)
    const isDemoMode = !webhookUsername || !webhookPassword
    
    if (!isDemoMode && !validateWebhookSignature(authHeader, webhookUsername, webhookPassword)) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload: WebhookPayload = await request.json()
    console.log('PhonePe webhook received:', JSON.stringify(payload, null, 2))

    const { shipmentId, orderId, transactionId, state } = parseWebhookPayload(payload)

    if (!shipmentId) {
      console.error('No shipment ID in webhook payload')
      return NextResponse.json({ error: 'Missing shipment ID' }, { status: 400 })
    }

    // Get shipment
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('id, status, driver_id, vehicle_id')
      .eq('id', shipmentId)
      .single()

    if (fetchError || !shipment) {
      console.error('Shipment not found:', shipmentId)
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    // Handle payment completion
    if (state === 'COMPLETED') {
      // Update shipment to delivered
      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          status: 'delivered',
          payment_status: 'completed',
          payment_transaction_id: transactionId,
          payment_completed_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
        })
        .eq('id', shipmentId)

      if (updateError) {
        console.error('Failed to update shipment:', updateError)
        return NextResponse.json({ error: 'Failed to update shipment' }, { status: 500 })
      }

      // Reset driver status to idle
      if (shipment.driver_id) {
        await supabase
          .from('drivers')
          .update({ status: 'idle' })
          .eq('id', shipment.driver_id)
      }

      // Reset vehicle status
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

      console.log(`Payment completed for shipment ${shipmentId}`)
    } else if (state === 'FAILED') {
      // Update payment status to failed
      await supabase
        .from('shipments')
        .update({
          payment_status: 'failed',
        })
        .eq('id', shipmentId)

      console.log(`Payment failed for shipment ${shipmentId}`)
    }

    // PhonePe expects 200 OK response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
