import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { customerPhone } = await request.json()

    if (!customerPhone) {
      return NextResponse.json(
        { error: 'Customer phone number is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RETELL_API_KEY
    const agentId = process.env.RETELL_AGENT_ID
    const fromNumber = process.env.RETELL_FROM_NUMBER

    if (!apiKey || !agentId || !fromNumber) {
      console.error('Missing Retell configuration:', { 
        hasApiKey: !!apiKey, 
        hasAgentId: !!agentId, 
        hasFromNumber: !!fromNumber 
      })
      return NextResponse.json(
        { error: 'Retell AI is not configured properly' },
        { status: 500 }
      )
    }

    // Format phone number to E.164 format if needed
    let formattedPhone = customerPhone.replace(/\s+/g, '').replace(/-/g, '')
    if (!formattedPhone.startsWith('+')) {
      // Assume Indian number if no country code
      if (formattedPhone.startsWith('91')) {
        formattedPhone = '+' + formattedPhone
      } else {
        formattedPhone = '+91' + formattedPhone
      }
    }

    console.log('Initiating Retell call:', {
      to: formattedPhone,
      from: fromNumber,
      agentId: agentId
    })

    // Create outbound call using Retell API
    // We must provide from_number and override_agent_id for the call
    const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: formattedPhone,
        override_agent_id: agentId, // Use override to specify agent for this call
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Retell API error:', data)
      return NextResponse.json(
        { error: data.message || 'Failed to initiate call' },
        { status: response.status }
      )
    }

    console.log('Retell call initiated successfully:', data)

    return NextResponse.json({
      success: true,
      callId: data.call_id,
      message: 'Call initiated successfully. You will receive a call shortly.',
    })

  } catch (error) {
    console.error('Error initiating Retell call:', error)
    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    )
  }
}
