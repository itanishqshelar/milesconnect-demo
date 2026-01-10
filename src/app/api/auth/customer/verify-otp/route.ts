import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { phoneNumber, otp } = await request.json()

    if (!phoneNumber || phoneNumber.length !== 10) {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    if (!otp || otp.length !== 4) {
      return NextResponse.json({ error: 'Valid 4-digit OTP is required' }, { status: 400 })
    }

    // Get customer with OTP
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, name, phone_number, login_otp, login_otp_expires_at')
      .eq('phone_number', phoneNumber)
      .single()

    if (fetchError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify OTP
    if (customer.login_otp !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 })
    }

    // Check expiry
    if (customer.login_otp_expires_at && new Date(customer.login_otp_expires_at) < new Date()) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 401 })
    }

    // Clear OTP after successful verification
    await supabase
      .from('customers')
      .update({
        login_otp: null,
        login_otp_expires_at: null,
      })
      .eq('id', customer.id)

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone_number,
      },
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
