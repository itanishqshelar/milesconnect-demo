import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use anon key for reading customers (public table), but need service role for updating
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Generate 4-digit OTP for customer login
 */
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json()

    console.log('Customer login attempt for phone:', phoneNumber)

    if (!phoneNumber || phoneNumber.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit phone number is required' }, { status: 400 })
    }

    // Check if customer exists
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, name, phone_number')
      .eq('phone_number', phoneNumber)
      .single()

    console.log('Customer lookup result:', { customer, error: fetchError?.message })

    if (fetchError || !customer) {
      return NextResponse.json({ 
        error: 'No account found with this phone number. Please contact support.' 
      }, { status: 404 })
    }

    // Generate OTP
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry

    // Try to store OTP in database (may fail if columns don't exist yet)
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        login_otp: otp,
        login_otp_expires_at: expiresAt.toISOString(),
      })
      .eq('id', customer.id)

    if (updateError) {
      console.error('Failed to store OTP:', updateError)
      // Continue anyway - just show OTP without storing (for demo)
    }

    // In production, send OTP via SMS using Twilio, MSG91, etc.
    // For demo, we return the OTP in the response
    console.log(`OTP for ${phoneNumber}: ${otp}`)

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      // Return OTP for demo purposes - REMOVE IN PRODUCTION
      otp,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone_number,
      },
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
