"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Truck, Phone, ArrowLeft, Loader2, KeyRound, CheckCircle } from "lucide-react"

export default function CustomerLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone')
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [generatedOtp, setGeneratedOtp] = useState("")
  const [customerData, setCustomerData] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length !== 10) {
      setError("Please enter a valid 10-digit phone number")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/customer/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send OTP')
        setIsLoading(false)
        return
      }

      // For demo purposes, the API returns the OTP to display
      setGeneratedOtp(data.otp)
      setCustomerData(data.customer)
      setStep('otp')
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 4) {
      setError("Please enter the 4-digit OTP")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/customer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid OTP')
        setIsLoading(false)
        return
      }

      // Store customer session in localStorage
      localStorage.setItem('customer', JSON.stringify(data.customer))
      
      setStep('success')
      
      // Redirect to customer dashboard after a brief moment
      setTimeout(() => {
        router.push('/customer/dashboard')
      }, 1500)
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <button 
            onClick={() => router.push('/login')} 
            className="absolute left-4 top-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Truck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Customer Login</CardTitle>
          <CardDescription>
            {step === 'phone' && 'Enter your registered phone number to continue'}
            {step === 'otp' && 'Enter the OTP sent to your phone'}
            {step === 'success' && 'Login successful!'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'phone' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-10"
                    maxLength={10}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <Button 
                onClick={handleSendOtp} 
                className="w-full h-12" 
                disabled={isLoading || phoneNumber.length !== 10}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </Button>
            </>
          )}

          {step === 'otp' && (
            <>
              {/* Demo OTP Display */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-sm text-amber-700 mb-1">Demo Mode: Your OTP is</p>
                <p className="text-3xl font-mono font-bold text-amber-900 tracking-widest">
                  {generatedOtp}
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  In production, this would be sent via SMS
                </p>
              </div>

              {customerData && (
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Welcome back,</p>
                  <p className="font-semibold">{customerData.name}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    placeholder="1234"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="pl-10 text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={4}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <Button 
                onClick={handleVerifyOtp} 
                className="w-full h-12" 
                disabled={isLoading || otp.length !== 4}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Login'
                )}
              </Button>

              <Button 
                variant="ghost" 
                className="w-full" 
                onClick={() => {
                  setStep('phone')
                  setOtp('')
                  setError('')
                }}
              >
                Change Phone Number
              </Button>
            </>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <p className="text-lg font-semibold">Login Successful!</p>
              <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
