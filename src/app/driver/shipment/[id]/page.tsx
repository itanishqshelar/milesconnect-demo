"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft,
  MapPin, 
  Navigation, 
  Loader2,
  Satellite,
  SatelliteIcon,
  Phone,
  ExternalLink,
  CircleDot
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ShipmentWithRelations } from "@/lib/types/database"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useWakeLock } from "@/hooks/use-wake-lock"

export default function ShipmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const shipmentId = params.id as string

  const [shipment, setShipment] = useState<ShipmentWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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
