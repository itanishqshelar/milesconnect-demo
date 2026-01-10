import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Complete Payment (for simulated/demo payments)
 * 
 * This endpoint is used when PhonePe credentials are not available
 * to manually complete a payment after simulation.
 */
export async function POST(request: Request) {
  try {
    const { shipmentId, transactionId } = await request.json()

    if (!shipmentId) {
      return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 })
    }

    // Get shipment
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('id, status, payment_status, driver_id, vehicle_id')
      .eq('id', shipmentId)
      .single()

    if (fetchError || !shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    // Validate state
    if (shipment.status !== 'arrived') {
      return NextResponse.json({ 
        error: 'Shipment must be in arrived status' 
      }, { status: 400 })
    }

    if (shipment.payment_status === 'completed') {
      return NextResponse.json({ 
        error: 'Payment already completed' 
      }, { status: 400 })
    }

    // Update shipment to delivered
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        status: 'delivered',
        payment_status: 'completed',
        payment_transaction_id: transactionId || `DEMO-TXN-${Date.now()}`,
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

    return NextResponse.json({
      success: true,
      message: 'Payment completed and shipment delivered',
    })
  } catch (error) {
    console.error('Payment completion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
