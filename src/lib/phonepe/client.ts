/**
 * PhonePe UAT Sandbox Integration
 * 
 * This module handles PhonePe UPI payment integration for delivery verification.
 * Supports both:
 * 1. OAuth/Checkout v2 API (when CLIENT_ID/SECRET configured)
 * 2. Salt Key/Checksum API for UAT Sandbox (when SALT_KEY configured)
 * 
 * UAT Sandbox VPAs for UPI Collect testing:
 * - success@ybl: Payment succeeds after 5 seconds
 * - failed@ybl: Payment fails after 5 seconds  
 * - pending@ybl: Payment pending for 60 seconds
 * 
 * Documentation: https://developer.phonepe.com/payment-gateway/uat-testing-go-live/uat-sandbox
 */

import crypto from 'crypto'

// Environment configuration
const PHONEPE_CONFIG = {
  sandbox: {
    authUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
    payUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay',
    statusUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order',
    // Salt Key based PG API endpoints (UAT Sandbox)
    pgPayUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay',
    pgStatusUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status',
  },
  production: {
    authUrl: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
    payUrl: 'https://api.phonepe.com/apis/pg/checkout/v2/pay',
    statusUrl: 'https://api.phonepe.com/apis/pg/checkout/v2/order',
    pgPayUrl: 'https://api.phonepe.com/apis/hermes/pg/v1/pay',
    pgStatusUrl: 'https://api.phonepe.com/apis/hermes/pg/v1/status',
  },
}

// Get current environment
const isProduction = process.env.PHONEPE_ENV === 'PRODUCTION'
const config = isProduction ? PHONEPE_CONFIG.production : PHONEPE_CONFIG.sandbox

// Credentials from environment
const CLIENT_ID = process.env.PHONEPE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET || ''
const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || '1'
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || ''
const SALT_KEY = process.env.PHONEPE_SALT_KEY || ''
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1'
const HOST_URL = process.env.PHONEPE_HOST_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox'

// Use simulation mode for demo (skip actual PhonePe API calls)
export const useSimulation = process.env.PHONEPE_USE_SIMULATION === 'true'

// Check which auth method is available
export const hasOAuthCredentials = Boolean(CLIENT_ID && CLIENT_SECRET)
export const hasSaltKeyCredentials = Boolean(SALT_KEY && MERCHANT_ID)

/**
 * Generate SHA256 checksum for Salt Key based authentication
 */
export function generateChecksum(payload: string, endpoint: string): string {
  const dataToSign = payload + endpoint + SALT_KEY
  const sha256Hash = crypto.createHash('sha256').update(dataToSign).digest('hex')
  return `${sha256Hash}###${SALT_INDEX}`
}

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Get OAuth access token from PhonePe
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token
  }

  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      client_version: CLIENT_VERSION,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PhonePe auth failed: ${error}`)
  }

  const data = await response.json()
  
  cachedToken = {
    token: data.access_token,
    expiresAt: data.expires_at * 1000, // Convert to ms
  }

  return cachedToken.token
}

export interface CreatePaymentRequest {
  shipmentId: string
  shipmentNumber: string
  amountInRupees: number
  customerPhone: string
  redirectUrl: string
}

export interface CreatePaymentResponse {
  success: boolean
  orderId?: string
  redirectUrl?: string
  error?: string
}

/**
 * Create a PhonePe payment request
 * Amount should be in rupees, will be converted to paisa
 */
export async function createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  try {
    const accessToken = await getAccessToken()
    
    // Generate unique merchant order ID
    const merchantOrderId = `PAY-${request.shipmentNumber}-${Date.now()}`
    
    // Amount in paisa (multiply by 100)
    const amountInPaisa = Math.round(request.amountInRupees * 100)

    const payload = {
      merchantOrderId,
      amount: amountInPaisa,
      expireAfter: 1200, // 20 minutes
      metaInfo: {
        udf1: request.shipmentId,
        udf2: request.shipmentNumber,
      },
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: `Payment for shipment ${request.shipmentNumber}`,
        merchantUrls: {
          redirectUrl: request.redirectUrl,
        },
      },
    }

    const response = await fetch(config.payUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `O-Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok || data.state === 'FAILED') {
      return {
        success: false,
        error: data.message || 'Payment creation failed',
      }
    }

    return {
      success: true,
      orderId: data.orderId,
      redirectUrl: data.redirectUrl,
    }
  } catch (error) {
    console.error('PhonePe payment creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(orderId: string): Promise<{
  success: boolean
  state: 'PENDING' | 'COMPLETED' | 'FAILED'
  transactionId?: string
  error?: string
}> {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(`${config.statusUrl}/${MERCHANT_ID}/${orderId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `O-Bearer ${accessToken}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        state: 'FAILED',
        error: data.message || 'Status check failed',
      }
    }

    return {
      success: true,
      state: data.state,
      transactionId: data.paymentDetails?.[0]?.transactionId,
    }
  } catch (error) {
    console.error('PhonePe status check error:', error)
    return {
      success: false,
      state: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Validate webhook signature from PhonePe
 * PhonePe sends: Authorization: SHA256(username:password)
 */
export function validateWebhookSignature(
  authHeader: string,
  webhookUsername: string,
  webhookPassword: string
): boolean {
  const expectedSignature = crypto
    .createHash('sha256')
    .update(`${webhookUsername}:${webhookPassword}`)
    .digest('hex')
  
  const expectedAuth = `SHA256 ${expectedSignature}`
  
  return authHeader === expectedAuth
}

export interface WebhookPayload {
  event: 'checkout.order.completed' | 'checkout.order.failed'
  payload: {
    orderId: string
    merchantId: string
    merchantOrderId: string
    state: 'COMPLETED' | 'FAILED' | 'PENDING'
    amount: number
    expireAt: number
    metaInfo: {
      udf1: string // shipmentId
      udf2: string // shipmentNumber
    }
    paymentDetails?: Array<{
      paymentMode: string
      transactionId: string
      timestamp: number
      amount: number
      state: string
    }>
  }
}

/**
 * Parse and extract shipment info from webhook payload
 */
export function parseWebhookPayload(payload: WebhookPayload): {
  shipmentId: string
  shipmentNumber: string
  orderId: string
  transactionId: string | null
  state: 'COMPLETED' | 'FAILED' | 'PENDING'
  amountInPaisa: number
} {
  return {
    shipmentId: payload.payload.metaInfo.udf1,
    shipmentNumber: payload.payload.metaInfo.udf2,
    orderId: payload.payload.orderId,
    transactionId: payload.payload.paymentDetails?.[0]?.transactionId || null,
    state: payload.payload.state,
    amountInPaisa: payload.payload.amount,
  }
}

/**
 * For demo/testing: Simulate a successful payment without actual PhonePe integration
 * This can be used when PhonePe credentials are not available
 */
export function simulatePaymentSuccess(): {
  orderId: string
  transactionId: string
} {
  return {
    orderId: `MOCK-ORD-${Date.now()}`,
    transactionId: `MOCK-TXN-${Date.now()}`,
  }
}

/**
 * UPI Collect Payment Request using Salt Key authentication
 * This is the UAT Sandbox flow for testing UPI payments
 * 
 * Test VPAs:
 * - success@ybl: Returns success after ~5 seconds
 * - failed@ybl: Returns failure after ~5 seconds
 * - pending@ybl: Returns pending for ~60 seconds then auto-resolves
 */
export interface UPICollectRequest {
  shipmentId: string
  shipmentNumber: string
  amountInRupees: number
  customerVpa: string
  redirectUrl: string
}

export interface UPICollectResponse {
  success: boolean
  orderId?: string
  merchantTransactionId?: string
  state?: 'PAYMENT_INITIATED' | 'PAYMENT_SUCCESS' | 'PAYMENT_ERROR' | 'PAYMENT_PENDING'
  message?: string
  error?: string
}

/**
 * Standard Checkout Payment - Redirects to PhonePe's hosted payment page
 * This provides the full payment gateway UI with UPI, Cards, Net Banking options
 */
export interface StandardCheckoutRequest {
  shipmentId: string
  shipmentNumber: string
  amountInRupees: number
  customerPhone?: string
  redirectUrl: string
  callbackUrl: string
}

export interface StandardCheckoutResponse {
  success: boolean
  redirectUrl?: string
  merchantTransactionId?: string
  error?: string
}

/**
 * Create a Standard Checkout payment that redirects to PhonePe's payment page
 * This provides full payment options: UPI (PhonePe, GPay, Paytm), Cards, Net Banking
 */
export async function createStandardCheckout(request: StandardCheckoutRequest): Promise<StandardCheckoutResponse> {
  // Generate unique transaction ID
  const merchantTransactionId = `MT${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
  
  // Use local simulation for demo purposes
  if (useSimulation || !hasSaltKeyCredentials) {
    // Redirect to local payment simulation page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return {
      success: true,
      merchantTransactionId,
      redirectUrl: `${appUrl}/payment/simulate?transactionId=${merchantTransactionId}&shipmentId=${request.shipmentId}&amount=${request.amountInRupees}&redirectUrl=${encodeURIComponent(request.redirectUrl)}`,
    }
  }

  try {
    // Amount in paisa
    const amountInPaisa = Math.round(request.amountInRupees * 100)

    // Payload for Standard Checkout (PAY_PAGE)
    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: `MUID${request.shipmentId.substring(0, 8)}`,
      amount: amountInPaisa,
      redirectUrl: request.redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl: request.callbackUrl,
      mobileNumber: request.customerPhone || '',
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    }

    // Base64 encode payload
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
    
    // Generate checksum
    const checksum = generateChecksum(base64Payload, '/pg/v1/pay')

    console.log('PhonePe Standard Checkout Request:', { merchantTransactionId, amount: amountInPaisa })

    const response = await fetch(`${HOST_URL}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
      },
      body: JSON.stringify({ request: base64Payload }),
    })

    const data = await response.json()
    console.log('PhonePe Response:', data)

    if (data.success && data.data?.instrumentResponse?.redirectInfo?.url) {
      return {
        success: true,
        merchantTransactionId,
        redirectUrl: data.data.instrumentResponse.redirectInfo.url,
      }
    } else {
      return {
        success: false,
        merchantTransactionId,
        error: data.message || 'Failed to create payment',
      }
    }
  } catch (error) {
    console.error('Standard Checkout error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check payment status using Salt Key auth
 */
export async function checkPaymentStatusSaltKey(merchantTransactionId: string): Promise<{
  success: boolean
  state: 'SUCCESS' | 'PENDING' | 'FAILED'
  transactionId?: string
  paymentInstrument?: string
  error?: string
}> {
  if (!hasSaltKeyCredentials) {
    return { success: true, state: 'SUCCESS', transactionId: `TXN${Date.now()}` }
  }

  try {
    const endpoint = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`
    const stringToHash = endpoint + SALT_KEY
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex')
    const checksum = `${sha256Hash}###${SALT_INDEX}`

    const response = await fetch(`${HOST_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': MERCHANT_ID,
      },
    })

    const data = await response.json()
    console.log('Payment Status Response:', data)

    if (data.success && data.code === 'PAYMENT_SUCCESS') {
      return {
        success: true,
        state: 'SUCCESS',
        transactionId: data.data?.transactionId,
        paymentInstrument: data.data?.paymentInstrument?.type,
      }
    } else if (data.code === 'PAYMENT_PENDING') {
      return {
        success: true,
        state: 'PENDING',
      }
    } else {
      return {
        success: false,
        state: 'FAILED',
        error: data.message || 'Payment failed',
      }
    }
  } catch (error) {
    console.error('Payment status check error:', error)
    return {
      success: false,
      state: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if VPA is a PhonePe test VPA for simulation
 */
function isTestVpa(vpa: string): boolean {
  const testVpas = ['success@ybl', 'failed@ybl', 'pending@ybl']
  return testVpas.includes(vpa.toLowerCase()) || 
         vpa.toLowerCase().includes('success') || 
         vpa.toLowerCase().includes('fail') || 
         vpa.toLowerCase().includes('pending')
}

/**
 * Initiate UPI Collect payment using Salt Key based PG API
 * This works with PhonePe UAT Sandbox test VPAs
 */
export async function initiateUPICollect(request: UPICollectRequest): Promise<UPICollectResponse> {
  // For test VPAs, always use local simulation
  // PhonePe test VPAs only work in redirect flow, not direct API
  if (isTestVpa(request.customerVpa)) {
    return simulateUPICollect(request.customerVpa)
  }
  
  // If no Salt Key credentials, use local simulation
  if (!hasSaltKeyCredentials) {
    return simulateUPICollect(request.customerVpa)
  }

  try {
    // Generate unique transaction ID
    const merchantTransactionId = `MT${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    
    // Amount in paisa
    const amountInPaisa = Math.round(request.amountInRupees * 100)

    // Payload for UPI Collect
    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: `MUID${request.shipmentId.substring(0, 8)}`,
      amount: amountInPaisa,
      redirectUrl: request.redirectUrl,
      redirectMode: 'POST',
      callbackUrl: request.redirectUrl.replace('/callback', '/webhook'),
      paymentInstrument: {
        type: 'UPI_COLLECT',
        vpa: request.customerVpa,
      },
    }

    // Base64 encode payload
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
    
    // Generate checksum
    const checksum = generateChecksum(base64Payload, '/pg/v1/pay')

    const response = await fetch(`${HOST_URL}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
      },
      body: JSON.stringify({ request: base64Payload }),
    })

    const data = await response.json()

    if (data.success) {
      return {
        success: true,
        orderId: data.data?.merchantTransactionId || merchantTransactionId,
        merchantTransactionId,
        state: data.data?.state || 'PAYMENT_INITIATED',
        message: 'Setup success via UPI Collect',
      }
    } else {
      return {
        success: false,
        merchantTransactionId,
        state: 'PAYMENT_ERROR',
        message: 'Setup failed via UPI Collect',
        error: data.message || 'UPI Collect initiation failed',
      }
    }
  } catch (error) {
    console.error('UPI Collect error:', error)
    return {
      success: false,
      state: 'PAYMENT_ERROR',
      message: 'Setup failed via UPI Collect',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check UPI Collect payment status using Salt Key auth
 */
export async function checkUPICollectStatus(merchantTransactionId: string): Promise<{
  success: boolean
  state: 'PAYMENT_SUCCESS' | 'PAYMENT_ERROR' | 'PAYMENT_PENDING' | 'PAYMENT_INITIATED'
  transactionId?: string
  message?: string
}> {
  if (!hasSaltKeyCredentials) {
    // Simulate based on merchant transaction ID pattern
    return { success: true, state: 'PAYMENT_SUCCESS', message: 'Payment completed' }
  }

  try {
    const endpoint = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`
    const checksum = generateChecksum('', endpoint)

    const response = await fetch(`${HOST_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': MERCHANT_ID,
      },
    })

    const data = await response.json()

    if (data.success && data.data) {
      return {
        success: true,
        state: data.data.state,
        transactionId: data.data.transactionId,
        message: data.data.state === 'PAYMENT_SUCCESS' 
          ? 'Setup success via UPI Collect' 
          : data.data.state === 'PAYMENT_ERROR'
          ? 'Setup failed via UPI Collect'
          : 'Payment pending',
      }
    }

    return {
      success: false,
      state: 'PAYMENT_ERROR',
      message: 'Status check failed',
    }
  } catch (error) {
    console.error('UPI status check error:', error)
    return {
      success: false,
      state: 'PAYMENT_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Simulate UPI Collect for local testing without PhonePe credentials
 * Uses VPA pattern to determine success/failure
 */
export function simulateUPICollect(vpa: string): UPICollectResponse {
  const merchantTransactionId = `MT${Date.now()}`
  
  // Check VPA pattern for test simulation
  if (vpa.toLowerCase().includes('success')) {
    return {
      success: true,
      orderId: merchantTransactionId,
      merchantTransactionId,
      state: 'PAYMENT_SUCCESS',
      message: 'Setup success via UPI Collect',
    }
  } else if (vpa.toLowerCase().includes('fail')) {
    return {
      success: false,
      merchantTransactionId,
      state: 'PAYMENT_ERROR',
      message: 'Setup failed via UPI Collect',
      error: 'Payment declined by user',
    }
  } else if (vpa.toLowerCase().includes('pending')) {
    return {
      success: true,
      orderId: merchantTransactionId,
      merchantTransactionId,
      state: 'PAYMENT_PENDING',
      message: 'Payment request sent to customer',
    }
  }
  
  // Default: treat as success for demo
  return {
    success: true,
    orderId: merchantTransactionId,
    merchantTransactionId,
    state: 'PAYMENT_SUCCESS',
    message: 'Setup success via UPI Collect',
  }
}
