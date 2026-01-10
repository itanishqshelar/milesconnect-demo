'use server'

import { revalidatePath } from 'next/cache'

interface RetellCallResponse {
  call_id: string
  call_status: string
  agent_id: string
  to_number: string
  from_number: string
}

export async function initiateRetellCall(toNumber: string, customerName: string) {
  const apiKey = process.env.RETELL_API_KEY
  const agentId = process.env.RETELL_AGENT_ID
  const fromNumber = process.env.RETELL_FROM_NUMBER

  if (!apiKey || !agentId || !fromNumber) {
    console.error('Retell configuration missing:', { 
      hasApiKey: !!apiKey, 
      hasAgentId: !!agentId, 
      hasFromNumber: !!fromNumber 
    })
    return { error: 'Retell AI is not configured properly' }
  }

  // Format phone number to E.164 format if needed
  let formattedNumber = toNumber.replace(/\D/g, '') // Remove non-digits
  if (!formattedNumber.startsWith('+')) {
    // Assume Indian number if no country code
    if (formattedNumber.length === 10) {
      formattedNumber = '+91' + formattedNumber
    } else if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
      formattedNumber = '+91' + formattedNumber
    } else {
      formattedNumber = '+' + formattedNumber
    }
  }

  try {
    const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        from_number: fromNumber,
        to_number: formattedNumber,
        metadata: {
          customer_name: customerName,
          source: 'MilesConnect Nova Care',
        },
        retell_llm_dynamic_variables: {
          customer_name: customerName,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Retell API error:', errorData)
      return { error: errorData.message || 'Failed to initiate call' }
    }

    const data: RetellCallResponse = await response.json()
    
    return { 
      success: true, 
      callId: data.call_id,
      status: data.call_status,
    }
  } catch (error) {
    console.error('Retell call error:', error)
    return { error: 'Failed to connect to Retell AI' }
  }
}
