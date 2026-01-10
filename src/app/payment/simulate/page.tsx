'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Check, 
  X, 
  Loader2,
  QrCode 
} from 'lucide-react'

type PaymentMethod = 'upi' | 'card' | 'netbanking'
type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed'

function PaymentSimulateContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const transactionId = searchParams.get('transactionId') || ''
  const shipmentId = searchParams.get('shipmentId') || ''
  const amount = parseFloat(searchParams.get('amount') || '0')
  const redirectUrl = searchParams.get('redirectUrl') || '/customer/dashboard'

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi')
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [upiId, setUpiId] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [selectedBank, setSelectedBank] = useState('')

  const banks = [
    'State Bank of India',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'Punjab National Bank',
  ]

  const handlePayment = async (simulatedStatus: 'success' | 'failed') => {
    setStatus('processing')
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    if (simulatedStatus === 'success') {
      setStatus('success')
      // Complete the payment on server
      try {
        await fetch('/api/payment/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId,
            shipmentId,
            status: 'SUCCESS',
          }),
        })
      } catch (error) {
        console.error('Error completing payment:', error)
      }
      
      // Redirect after a short delay
      setTimeout(() => {
        const url = new URL(redirectUrl, window.location.origin)
        url.searchParams.set('transactionId', transactionId)
        url.searchParams.set('status', 'SUCCESS')
        router.push(url.toString())
      }, 1500)
    } else {
      setStatus('failed')
      setTimeout(() => setStatus('pending'), 2000)
    }
  }

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-600 to-purple-800">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-purple-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground">Please wait while we process your payment...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-600 to-green-800">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-green-700">Payment Successful!</h2>
            <p className="text-muted-foreground mb-2">₹{amount.toFixed(2)} paid</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-600 to-red-800">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
              <X className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-red-700">Payment Failed</h2>
            <p className="text-muted-foreground">Please try again</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center text-white mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">₹</span>
            </div>
            <span className="text-xl font-semibold">PhonePe</span>
          </div>
          <p className="text-purple-200 text-sm">Payment Simulation (Demo)</p>
        </div>

        {/* Amount Card */}
        <Card className="mb-4">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
            <p className="text-4xl font-bold">₹{amount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Transaction: {transactionId}
            </p>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* UPI */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedMethod === 'upi' 
                  ? 'border-purple-600 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => setSelectedMethod('upi')}
            >
              <div className="flex items-center gap-3 mb-3">
                <Smartphone className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="font-medium">UPI</p>
                  <p className="text-xs text-muted-foreground">PhonePe, GPay, Paytm, BHIM</p>
                </div>
              </div>
              {selectedMethod === 'upi' && (
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <Label htmlFor="upi">UPI ID</Label>
                    <Input 
                      id="upi"
                      placeholder="yourname@ybl"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use success@ybl for success, failed@ybl for failure
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <QrCode className="h-4 w-4" />
                    <span>or Scan QR Code</span>
                  </div>
                </div>
              )}
            </div>

            {/* Card */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedMethod === 'card' 
                  ? 'border-purple-600 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => setSelectedMethod('card')}
            >
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="font-medium">Credit / Debit Card</p>
                  <p className="text-xs text-muted-foreground">Visa, Mastercard, RuPay</p>
                </div>
              </div>
              {selectedMethod === 'card' && (
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input 
                      id="cardNumber"
                      placeholder="4208 5851 9011 6667"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="expiry">Expiry</Label>
                      <Input 
                        id="expiry"
                        placeholder="06/27"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input 
                        id="cvv"
                        type="password"
                        placeholder="508"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Test Card: 4208 5851 9011 6667, Exp: 06/27, CVV: 508
                  </p>
                </div>
              )}
            </div>

            {/* Net Banking */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedMethod === 'netbanking' 
                  ? 'border-purple-600 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => setSelectedMethod('netbanking')}
            >
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="font-medium">Net Banking</p>
                  <p className="text-xs text-muted-foreground">All Indian Banks</p>
                </div>
              </div>
              {selectedMethod === 'netbanking' && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    {banks.map((bank) => (
                      <Button
                        key={bank}
                        variant={selectedBank === bank ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedBank(bank)
                        }}
                      >
                        {bank}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4">
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
                onClick={() => handlePayment('success')}
              >
                <Check className="h-4 w-4 mr-2" />
                Simulate Success
              </Button>
              <Button 
                variant="destructive"
                className="w-full"
                size="lg"
                onClick={() => handlePayment('failed')}
              >
                <X className="h-4 w-4 mr-2" />
                Simulate Failure
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              This is a demo payment simulation. No real payment will be processed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PaymentSimulatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-600 to-purple-800">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-purple-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Loading Payment...</h2>
          </CardContent>
        </Card>
      </div>
    }>
      <PaymentSimulateContent />
    </Suspense>
  )
}