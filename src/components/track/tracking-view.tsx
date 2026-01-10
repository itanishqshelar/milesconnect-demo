"use client"

import { useState, useEffect } from "react"
import { ShipmentWithRelations, ShipmentStatus } from "@/lib/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Circle,
  XCircle,
  Navigation,
  Loader2,
} from "lucide-react"

interface TrackingViewProps {
  shipment: ShipmentWithRelations
  onNewSearch: () => void
}

interface TimelineStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  status: "completed" | "current" | "upcoming" | "cancelled"
  time?: string
}

function getStatusConfig(status: ShipmentStatus) {
  switch (status) {
    case "pending":
      return {
        label: "Order Placed",
        color: "bg-amber-100 text-amber-700 border-amber-200",
        bgGradient: "from-amber-500 to-orange-500",
        description: "Your order is being processed",
      }
    case "in_transit":
      return {
        label: "In Transit",
        color: "bg-blue-100 text-blue-700 border-blue-200",
        bgGradient: "from-blue-500 to-indigo-500",
        description: "Your package is on the way",
      }
    case "arrived":
      return {
        label: "Driver Arrived",
        color: "bg-orange-100 text-orange-700 border-orange-200",
        bgGradient: "from-orange-500 to-amber-500",
        description: "Driver is at your location",
      }
    case "delivered":
      return {
        label: "Delivered",
        color: "bg-green-100 text-green-700 border-green-200",
        bgGradient: "from-green-500 to-emerald-500",
        description: "Package has been delivered",
      }
    case "cancelled":
      return {
        label: "Cancelled",
        color: "bg-red-100 text-red-700 border-red-200",
        bgGradient: "from-red-500 to-rose-500",
        description: "This shipment has been cancelled",
      }
    default:
      return {
        label: "Unknown",
        color: "bg-gray-100 text-gray-700 border-gray-200",
        bgGradient: "from-gray-500 to-slate-500",
        description: "Status unknown",
      }
  }
}

function getTimelineSteps(shipment: ShipmentWithRelations): TimelineStep[] {
  const status = shipment.status
  const createdAt = new Date(shipment.created_at)
  const deliveredAt = shipment.delivered_at ? new Date(shipment.delivered_at) : null

  const formatTime = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  if (status === "cancelled") {
    return [
      {
        id: "placed",
        title: "Order Placed",
        description: "Shipment request received",
        icon: <Package className="h-5 w-5" />,
        status: "completed",
        time: formatTime(createdAt),
      },
      {
        id: "cancelled",
        title: "Cancelled",
        description: "This shipment has been cancelled",
        icon: <XCircle className="h-5 w-5" />,
        status: "cancelled",
      },
    ]
  }

  const steps: TimelineStep[] = [
    {
      id: "placed",
      title: "Order Placed",
      description: "Shipment request received",
      icon: <Package className="h-5 w-5" />,
      status: "completed",
      time: formatTime(createdAt),
    },
    {
      id: "processing",
      title: "Processing",
      description: "Package ready for dispatch",
      icon: <Clock className="h-5 w-5" />,
      status: status === "pending" ? "current" : "completed",
      time: status !== "pending" ? formatTime(new Date(createdAt.getTime() + 30 * 60000)) : undefined,
    },
    {
      id: "in_transit",
      title: "In Transit",
      description: "On the way to destination",
      icon: <Truck className="h-5 w-5" />,
      status:
        status === "in_transit"
          ? "current"
          : status === "arrived" || status === "delivered"
          ? "completed"
          : "upcoming",
      time: status === "in_transit" || status === "arrived" || status === "delivered" 
        ? formatTime(new Date(createdAt.getTime() + 60 * 60000)) 
        : undefined,
    },
    {
      id: "arrived",
      title: "Driver Arrived",
      description: "Driver is at your location",
      icon: <MapPin className="h-5 w-5" />,
      status:
        status === "arrived"
          ? "current"
          : status === "delivered"
          ? "completed"
          : "upcoming",
      time: status === "arrived" || status === "delivered"
        ? formatTime(new Date(createdAt.getTime() + 120 * 60000))
        : undefined,
    },
    {
      id: "delivered",
      title: "Delivered",
      description: "Package delivered successfully",
      icon: <CheckCircle2 className="h-5 w-5" />,
      status: status === "delivered" ? "completed" : "upcoming",
      time: deliveredAt ? formatTime(deliveredAt) : undefined,
    },
  ]

  return steps
}

function extractCity(location: string): string {
  // Extract city name from location string
  // Common formats: "City, State, Country" or "Address, City, State"
  const parts = location.split(",").map((p) => p.trim())
  
  // Return the first part which is typically the city/place name
  return parts[0] || location
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
    )
    const data = await response.json()
    
    if (data.features && data.features.length > 0) {
      // Get the place name (city/town)
      return data.features[0].text || data.features[0].place_name?.split(",")[0] || "Unknown location"
    }
  } catch (error) {
    console.error("Reverse geocoding failed:", error)
  }
  return "Unknown location"
}

function getStaticCurrentLocation(shipment: ShipmentWithRelations): string {
  const status = shipment.status

  if (status === "pending") {
    return extractCity(shipment.start_location)
  }
  
  if (status === "delivered") {
    return extractCity(shipment.destination)
  }

  if (status === "in_transit") {
    // Fallback when no live location available
    return `En route to ${extractCity(shipment.destination)}`
  }

  return "Location unavailable"
}

export function TrackingView({ shipment, onNewSearch }: TrackingViewProps) {
  const [currentLocation, setCurrentLocation] = useState<string>("")
  const [isLoadingLocation, setIsLoadingLocation] = useState(true)
  
  const statusConfig = getStatusConfig(shipment.status)
  const timelineSteps = getTimelineSteps(shipment)
  const eta = shipment.vehicles?.eta

  useEffect(() => {
    async function fetchCurrentLocation() {
      setIsLoadingLocation(true)
      
      if (shipment.status === "pending") {
        setCurrentLocation(extractCity(shipment.start_location))
        setIsLoadingLocation(false)
        return
      }
      
      if (shipment.status === "delivered") {
        setCurrentLocation(extractCity(shipment.destination))
        setIsLoadingLocation(false)
        return
      }
      
      if (shipment.status === "cancelled") {
        setCurrentLocation("Shipment cancelled")
        setIsLoadingLocation(false)
        return
      }
      
      // For in_transit, get live location from vehicle coordinates
      if (shipment.status === "in_transit" && shipment.vehicles?.latitude && shipment.vehicles?.longitude) {
        const cityName = await reverseGeocode(shipment.vehicles.latitude, shipment.vehicles.longitude)
        setCurrentLocation(cityName)
        setIsLoadingLocation(false)
        return
      }
      
      // Fallback
      setCurrentLocation(getStaticCurrentLocation(shipment))
      setIsLoadingLocation(false)
    }
    
    fetchCurrentLocation()
  }, [shipment])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`bg-gradient-to-r ${statusConfig.bgGradient} text-white`}>
        <div className="max-w-lg mx-auto px-4 py-6">
          <button
            onClick={onNewSearch}
            className="flex items-center text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Track another</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm font-medium">Tracking ID</p>
              <p className="text-xl font-bold font-mono tracking-wider">
                {shipment.shipment_number}
              </p>
            </div>
            <Badge className={`${statusConfig.color} px-3 py-1.5 text-sm font-semibold`}>
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status Card */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${statusConfig.bgGradient}`}>
                  {shipment.status === "delivered" ? (
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  ) : shipment.status === "arrived" ? (
                    <MapPin className="h-6 w-6 text-white" />
                  ) : shipment.status === "in_transit" ? (
                    <Truck className="h-6 w-6 text-white" />
                  ) : shipment.status === "cancelled" ? (
                    <XCircle className="h-6 w-6 text-white" />
                  ) : (
                    <Package className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-gray-900">
                    {statusConfig.description}
                  </p>
                  {eta && shipment.status === "in_transit" && (
                    <p className="text-sm text-gray-500">
                      Expected by{" "}
                      {new Date(eta).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Current Location */}
            <div className="p-4 bg-gray-50/50">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Navigation className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Current Location
                  </p>
                  {isLoadingLocation ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      <span className="text-sm text-gray-400">Fetching location...</span>
                    </div>
                  ) : (
                    <p className="text-base font-semibold text-gray-900 mt-0.5">
                      {currentLocation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OTP Display Card - Shown when driver has arrived */}
        {shipment.status === "arrived" && shipment.delivery_otp && (
          <Card className="border-2 border-orange-400 shadow-lg bg-orange-50">
            <CardContent className="p-6">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500 text-white mx-auto">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-orange-800">
                    🔐 Delivery Verification Code
                  </h3>
                  <p className="text-sm text-orange-700 mt-1">
                    Your driver has arrived! Share this code with them.
                  </p>
                </div>
                <div className="bg-white rounded-xl py-4 px-6 shadow-inner">
                  <p className="text-4xl font-mono font-bold tracking-[0.4em] text-orange-900">
                    {shipment.delivery_otp}
                  </p>
                </div>
                <p className="text-xs text-orange-600">
                  Do not share this code with anyone except your driver
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* From */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase">From</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {extractCity(shipment.start_location)}
                </p>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0">
                <div className="w-12 h-0.5 bg-gray-200 relative">
                  <div 
                    className={`absolute top-0 left-0 h-full bg-gradient-to-r ${statusConfig.bgGradient} transition-all`}
                    style={{ 
                      width: shipment.status === "delivered" ? "100%" : 
                             shipment.status === "in_transit" ? "50%" : 
                             shipment.status === "pending" ? "10%" : "0%" 
                    }}
                  />
                </div>
              </div>

              {/* To */}
              <div className="flex-1 text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase">To</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {extractCity(shipment.destination)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Timeline */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Delivery Timeline</h3>
            <div className="relative">
              {timelineSteps.map((step, index) => (
                <div key={step.id} className="flex gap-4">
                  {/* Timeline Line & Icon */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        step.status === "completed"
                          ? "bg-green-100 text-green-600"
                          : step.status === "current"
                          ? "bg-blue-100 text-blue-600 ring-4 ring-blue-50"
                          : step.status === "cancelled"
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {step.icon}
                    </div>
                    {index < timelineSteps.length - 1 && (
                      <div
                        className={`w-0.5 h-12 ${
                          step.status === "completed"
                            ? "bg-green-300"
                            : step.status === "cancelled"
                            ? "bg-red-200"
                            : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-8 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p
                          className={`font-semibold ${
                            step.status === "upcoming"
                              ? "text-gray-400"
                              : step.status === "cancelled"
                              ? "text-red-600"
                              : "text-gray-900"
                          }`}
                        >
                          {step.title}
                        </p>
                        <p
                          className={`text-sm mt-0.5 ${
                            step.status === "upcoming" ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          {step.description}
                        </p>
                      </div>
                      {step.time && (
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                          {step.time}
                        </span>
                      )}
                    </div>
                    {step.status === "current" && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Circle className="h-2 w-2 text-blue-500 fill-current animate-pulse" />
                        <span className="text-xs font-medium text-blue-600">In Progress</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipment Details */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Origin</span>
                <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
                  {shipment.start_location}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Destination</span>
                <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
                  {shipment.destination}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(shipment.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {shipment.vehicles && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">Vehicle</span>
                  <span className="text-sm font-medium text-gray-900">
                    {shipment.vehicles.type} • {shipment.vehicles.license_plate}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Track Another Button */}
        <Button
          onClick={onNewSearch}
          variant="outline"
          className="w-full h-12 text-base"
        >
          <MapPin className="mr-2 h-5 w-5" />
          Track Another Shipment
        </Button>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-gray-400">
            Need help? Contact our support team
          </p>
        </div>
      </div>
    </div>
  )
}
