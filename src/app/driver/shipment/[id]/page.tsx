"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  ArrowLeft,
  MapPin, 
  Navigation, 
  Loader2,
  Satellite,
  SatelliteIcon,
  Phone,
  ExternalLink,
  CircleDot,
  HandCoins,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  PartyPopper
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ShipmentWithRelations } from "@/lib/types/database"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useWakeLock } from "@/hooks/use-wake-lock"
import { markDriverArrived, verifyDeliveryOTP, regenerateDeliveryOTP } from "@/lib/actions/shipments"

export default function ShipmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const shipmentId = params.id as string

  const [shipment, setShipment] = useState<ShipmentWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Secure Handshake state
  const [isArriving, setIsArriving] = useState(false)
  const [enteredOtp, setEnteredOtp] = useState("")
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [otpError, setOtpError] = useState("")
  const [isRegeneratingOtp, setIsRegeneratingOtp] = useState(false)
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false)
  const [paymentResult, setPaymentResult] = useState<'success' | 'failed' | null>(null)

  // Get vehicle ID for GPS tracking
  const vehicleId = shipment?.vehicles?.id || null

  // GPS tracking hook
  const { 
    isTracking, 
    latitude, 
    longitude, 
    accuracy,
    error: gpsError,
    lastUpdate,
    startTracking, 
    stopTracking 
  } = useGeolocation({ vehicleId, updateIntervalMs: 5000 })

  // Wake lock hook
  const { 
    isActive: isWakeLockActive, 
    requestWakeLock, 
    releaseWakeLock 
  } = useWakeLock()

  useEffect(() => {
    fetchShipment()
    
    // Check for payment result from callback
    const paymentParam = searchParams.get('payment')
    if (paymentParam === 'success') {
      setPaymentResult('success')
    } else if (paymentParam === 'failed') {
      setPaymentResult('failed')
    }
  }, [shipmentId, searchParams])

  // Set up realtime subscription for shipment updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`shipment-${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `id=eq.${shipmentId}`,
        },
        () => {
          fetchShipment()
        }
      )
      .subscribe()

    // Also poll every 3 seconds when waiting for payment
    // This is a backup in case realtime isn't working
    const pollInterval = setInterval(() => {
      fetchShipment()
    }, 3000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [shipmentId])

  const fetchShipment = async () => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('shipments')
      .select('*, drivers(*), vehicles(*)')
      .eq('id', shipmentId)
      .single()

    if (!error && data) {
      setShipment(data as ShipmentWithRelations)
    }
    setIsLoading(false)
  }

  // Toggle live tracking
  const handleToggleTracking = async () => {
    if (isTracking) {
      stopTracking()
      releaseWakeLock()
    } else {
      startTracking()
      await requestWakeLock()
    }
  }

  // Open Google Maps for navigation
  const openGoogleMaps = (lat: number | null, lng: number | null, label: string) => {
    if (!lat || !lng) {
      alert(`No coordinates available for ${label}`)
      return
    }
    // Deep link to Google Maps with directions
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    window.open(url, '_blank')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'in_transit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'arrived':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Handle "I'm Here" - Driver arrived
  const handleArrived = async () => {
    setIsArriving(true)
    const result = await markDriverArrived(shipmentId)
    setIsArriving(false)
    
    if (result.error) {
      alert(result.error)
    } else {
      // Refresh shipment data
      fetchShipment()
    }
  }

  // Handle OTP verification
  const handleVerifyOtp = async () => {
    if (enteredOtp.length !== 4) {
      setOtpError("Please enter the 4-digit OTP")
      return
    }
    
    setIsVerifyingOtp(true)
    setOtpError("")
    
    const result = await verifyDeliveryOTP(shipmentId, enteredOtp)
    
    setIsVerifyingOtp(false)
    
    if (result.error) {
      setOtpError(result.error)
    } else {
      // Refresh shipment data
      fetchShipment()
    }
  }

  // Handle OTP regeneration
  const handleRegenerateOtp = async () => {
    setIsRegeneratingOtp(true)
    const result = await regenerateDeliveryOTP(shipmentId)
    setIsRegeneratingOtp(false)
    
    if (result.error) {
      alert(result.error)
    } else {
      fetchShipment()
    }
  }

  // Handle payment initiation (customer will pay via their dashboard)
  // This function is kept for backwards compatibility but payment is now customer-initiated
  const handleInitiatePayment = async () => {
    // Payment is now initiated by customer via their dashboard
    // Driver just waits for payment confirmation
    alert('Payment will be collected from customer. Please wait for customer to complete payment on their device.')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Shipment not found</p>
        <Button onClick={() => router.push('/driver/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b px-4 py-3 flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push('/driver/dashboard')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold">{shipment.shipment_number}</h1>
          <Badge className={getStatusColor(shipment.status)}>
            {shipment.status === 'in_transit' ? 'In Transit' : shipment.status}
          </Badge>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {/* Live Tracking Toggle */}
        <Card className={isTracking ? 'border-green-500 border-2' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {isTracking ? (
                <Satellite className="h-5 w-5 text-green-500 animate-pulse" />
              ) : (
                <SatelliteIcon className="h-5 w-5 text-muted-foreground" />
              )}
              Live GPS Tracking
            </CardTitle>
            <CardDescription>
              {isTracking 
                ? 'Your location is being shared in real-time' 
                : 'Start tracking to share your live location'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleToggleTracking}
              className={`w-full h-12 ${isTracking ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
              disabled={!vehicleId}
            >
              {isTracking ? (
                <>
                  <CircleDot className="mr-2 h-5 w-5 animate-pulse" />
                  Stop Live Tracking
                </>
              ) : (
                <>
                  <Satellite className="mr-2 h-5 w-5" />
                  Go Live
                </>
              )}
            </Button>

            {!vehicleId && (
              <p className="text-xs text-center text-yellow-600">
                No vehicle assigned to this shipment
              </p>
            )}

            {isTracking && (
              <div className="text-xs text-center space-y-1 text-muted-foreground">
                <p>
                  📍 {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                  {accuracy && ` (±${accuracy.toFixed(0)}m)`}
                </p>
                {lastUpdate && (
                  <p>Last update: {lastUpdate.toLocaleTimeString()}</p>
                )}
                {isWakeLockActive && (
                  <p className="text-green-600">🔒 Screen wake lock active</p>
                )}
              </div>
            )}

            {gpsError && (
              <p className="text-xs text-center text-red-500">{gpsError}</p>
            )}
          </CardContent>
        </Card>

        {/* Pickup Location */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <CardTitle className="text-base">Pickup Location</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{shipment.start_location}</p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => openGoogleMaps(shipment.start_lat, shipment.start_lng, 'pickup')}
            >
              <Navigation className="mr-2 h-4 w-4" />
              Navigate to Pickup
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Destination */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-red-500" />
              <CardTitle className="text-base">Destination</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{shipment.destination}</p>
            <Button 
              className="w-full"
              onClick={() => openGoogleMaps(shipment.dest_lat, shipment.dest_lng, 'destination')}
            >
              <Navigation className="mr-2 h-4 w-4" />
              Navigate to Destination
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* SECURE HANDSHAKE SECTION */}
        {/* ============================================ */}

        {/* Delivered Success Message */}
        {shipment.status === 'delivered' && (
          <Card className="border-green-500 border-2 bg-green-50 dark:bg-green-900/20">
            <CardContent className="pt-6 text-center">
              <PartyPopper className="h-12 w-12 mx-auto text-green-600 mb-3" />
              <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
                Delivery Completed! 🎉
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Payment received and shipment marked as delivered.
              </p>
              {shipment.payment_transaction_id && (
                <p className="text-xs text-muted-foreground mt-2">
                  Transaction ID: {shipment.payment_transaction_id}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Arrived Button (shown when in_transit) */}
        {shipment.status === 'in_transit' && (
          <Card className="border-orange-400 border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-orange-500" />
                Delivery Confirmation
              </CardTitle>
              <CardDescription>
                When you arrive at the destination, tap the button below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleArrived}
                className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-lg"
                disabled={isArriving}
              >
                {isArriving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-5 w-5" />
                    I&apos;m Here - Arrived at Destination
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: OTP Verification (shown when arrived but not verified) */}
        {shipment.status === 'arrived' && !shipment.otp_verified_at && (
          <Card className="border-purple-400 border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-purple-500" />
                OTP Verification
              </CardTitle>
              <CardDescription>
                Ask the customer for their 4-digit delivery code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-purple-800 dark:text-purple-300 mb-2">
                  📱 Customer can see OTP in their MilesConnect app
                </p>
                <p className="text-xs text-muted-foreground">
                  The customer must share this code with you verbally
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter 4-digit OTP"
                  value={enteredOtp}
                  onChange={(e) => {
                    setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 4))
                    setOtpError("")
                  }}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                  maxLength={4}
                />
                {otpError && (
                  <p className="text-sm text-red-500 text-center flex items-center justify-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {otpError}
                  </p>
                )}
              </div>

              <Button 
                onClick={handleVerifyOtp}
                className="w-full h-12 bg-purple-500 hover:bg-purple-600"
                disabled={isVerifyingOtp || enteredOtp.length !== 4}
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Verify OTP
                  </>
                )}
              </Button>

              <Button 
                variant="ghost" 
                className="w-full"
                onClick={handleRegenerateOtp}
                disabled={isRegeneratingOtp}
              >
                {isRegeneratingOtp ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Regenerate OTP
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Awaiting Customer Payment (shown when OTP verified but not paid) */}
        {shipment.status === 'arrived' && shipment.otp_verified_at && shipment.payment_status !== 'completed' && (
          <Card className="border-green-400 border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-green-500" />
                Awaiting Customer Payment
              </CardTitle>
              <CardDescription>
                OTP verified! Customer is completing payment on their device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Amount to Collect</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  ₹{shipment.revenue?.toLocaleString('en-IN') || '0'}
                </p>
              </div>

              {shipment.payment_status === 'initiated' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
                    <span className="font-semibold text-yellow-700">Payment in Progress</span>
                  </div>
                  <p className="text-sm text-yellow-600">
                    Waiting for customer to complete UPI payment...
                  </p>
                </div>
              )}

              {shipment.payment_status === 'failed' && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <p className="text-sm text-red-600 flex items-center justify-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Payment failed. Ask customer to retry on their device.
                  </p>
                </div>
              )}

              {(!shipment.payment_status || shipment.payment_status === 'pending') && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-700">Customer Action Required</span>
                  </div>
                  <p className="text-sm text-blue-600">
                    Ask the customer to open their shipment dashboard and complete the UPI payment.
                  </p>
                </div>
              )}

              <div className="flex flex-col items-center gap-2 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Auto-refreshing every 3 seconds...
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchShipment}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vehicle Info */}
        {shipment.vehicles && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">License Plate</span>
                <span className="font-medium">{shipment.vehicles.license_plate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{shipment.vehicles.type}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help */}
        <Card>
          <CardContent className="pt-4">
            <Button variant="outline" className="w-full" asChild>
              <a href="tel:+1234567890">
                <Phone className="mr-2 h-4 w-4" />
                Call Dispatch
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
