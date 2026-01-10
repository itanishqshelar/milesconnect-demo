import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createStandardCheckout, hasSaltKeyCredentials } from '@/lib/phonepe/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { shipmentId } = await request.json()

    if (!shipmentId) {
      return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 })
    }

    // Get shipment details
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('*, customers(*)')
      .eq('id', shipmentId)
      .single()

    if (fetchError || !shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    // Validate shipment state
    if (shipment.status !== 'arrived') {
      return NextResponse.json({ 
        error: 'Payment can only be initiated for arrived shipments' 
      }, { status: 400 })
    }

    if (!shipment.otp_verified_at) {
      return NextResponse.json({ 
        error: 'OTP must be verified before payment' 
      }, { status: 400 })
    }

    if (shipment.payment_status === 'completed') {
      return NextResponse.json({ 
        error: 'Payment already completed' 
      }, { status: 400 })
    }

    const amount = shipment.revenue || 0
    if (amount <= 0) {
      return NextResponse.json({ 
        error: 'Invalid payment amount' 
      }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = `${appUrl}/api/payment/callback?shipmentId=${shipmentId}`
    const callbackUrl = `${appUrl}/api/payment/webhook`

    // Create Standard Checkout payment (redirects to PhonePe payment page)
    const result = await createStandardCheckout({
      shipmentId,
      shipmentNumber: shipment.shipment_number,
      amountInRupees: amount,
      customerPhone: shipment.customers?.phone_number || '',
      redirectUrl,
      callbackUrl,
    })

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to create payment' 
      }, { status: 500 })
    }

    // Update shipment with payment initiated status
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        payment_status: 'initiated',
        phonepe_order_id: result.merchantTransactionId,
      })
      .eq('id', shipmentId)

    if (updateError) {
      console.error('Failed to update shipment:', updateError)
    }

    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      merchantTransactionId: result.merchantTransactionId,
      amount,
      isUATSandbox: hasSaltKeyCredentials,
    })
  } catch (error) {
    console.error('Payment initiation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
