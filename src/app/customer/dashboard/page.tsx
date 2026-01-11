"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Package, 
  Truck, 
  MapPin, 
  LogOut, 
  Loader2,
  CheckCircle2,
  Clock,
  KeyRound,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Navigation,
  Phone,
  CreditCard,
  Wallet,
  AlertCircle
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ShipmentWithRelations, ShipmentStatus } from "@/lib/types/database"
import { CallNovaButton } from "@/components/customer/call-nova-button"
import { DownloadInvoiceButton } from "@/components/customer/download-invoice-button"

interface CustomerSession {
  id: string
  name: string
  phone: string
}

// Status configuration for display
function getStatusConfig(status: ShipmentStatus) {
  switch (status) {
    case 'pending':
      return { 
        label: 'Pending', 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: Clock,
        bgGradient: 'from-yellow-500 to-amber-500',
        description: 'Your order is being processed'
      }
    case 'in_transit':
      return { 
        label: 'In Transit', 
        color: 'bg-blue-100 text-blue-800', 
        icon: Truck,
        bgGradient: 'from-blue-500 to-indigo-500',
        description: 'Your package is on the way'
      }
    case 'arrived':
      return { 
        label: 'Driver Arrived', 
        color: 'bg-orange-100 text-orange-800', 
        icon: MapPin,
        bgGradient: 'from-orange-500 to-amber-500',
        description: 'Driver is at your location'
      }
    case 'delivered':
      return { 
        label: 'Delivered', 
        color: 'bg-green-100 text-green-800', 
        icon: CheckCircle2,
        bgGradient: 'from-green-500 to-emerald-500',
        description: 'Package has been delivered'
      }
    case 'cancelled':
      return { 
        label: 'Cancelled', 
        color: 'bg-red-100 text-red-800', 
        icon: XCircle,
        bgGradient: 'from-red-500 to-rose-500',
        description: 'This shipment has been cancelled'
      }
    default:
      return { 
        label: status, 
        color: 'bg-gray-100 text-gray-800', 
        icon: Package,
        bgGradient: 'from-gray-500 to-slate-500',
        description: 'Status unknown'
      }
  }
}

function getPaymentStatusBadge(status: string | null) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-500"><CreditCard className="h-3 w-3 mr-1" />Paid</Badge>
    case 'initiated':
      return <Badge className="bg-yellow-500"><CreditCard className="h-3 w-3 mr-1" />Pending</Badge>
    case 'failed':
      return <Badge className="bg-red-500"><CreditCard className="h-3 w-3 mr-1" />Failed</Badge>
    default:
      return null
  }
}

// Timeline step interface
interface TimelineStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  status: "completed" | "current" | "upcoming" | "cancelled"
  time?: string
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
        icon: <Package className="h-4 w-4" />,
        status: "completed",
        time: formatTime(createdAt),
      },
      {
        id: "cancelled",
        title: "Cancelled",
        description: "This shipment has been cancelled",
        icon: <XCircle className="h-4 w-4" />,
        status: "cancelled",
      },
    ]
  }

  const steps: TimelineStep[] = [
    {
      id: "placed",
      title: "Order Placed",
      description: "Shipment created",
      icon: <Package className="h-4 w-4" />,
      status: "completed",
      time: formatTime(createdAt),
    },
    {
      id: "in_transit",
      title: "In Transit",
      description: "On the way",
      icon: <Truck className="h-4 w-4" />,
      status:
        status === "in_transit"
          ? "current"
          : status === "arrived" || status === "delivered"
          ? "completed"
          : "upcoming",
    },
    {
      id: "arrived",
      title: "Arrived",
      description: "At destination",
      icon: <MapPin className="h-4 w-4" />,
      status:
        status === "arrived"
          ? "current"
          : status === "delivered"
          ? "completed"
          : "upcoming",
    },
    {
      id: "delivered",
      title: "Delivered",
      description: "Completed",
      icon: <CheckCircle2 className="h-4 w-4" />,
      status: status === "delivered" ? "completed" : "upcoming",
      time: deliveredAt ? formatTime(deliveredAt) : undefined,
    },
  ]

  return steps
}

// Shipment Card Component with expandable tracking
function ShipmentCard({ shipment, onPaymentComplete, customerName, customerPhone }: { 
  shipment: ShipmentWithRelations, 
  onPaymentComplete?: () => void,
  customerName?: string,
  customerPhone?: string 
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<string>("")
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  
  const statusConfig = getStatusConfig(shipment.status)
  const StatusIcon = statusConfig.icon
  const showOTP = shipment.status === 'arrived' && shipment.delivery_otp
  const timelineSteps = getTimelineSteps(shipment)
  
  // Show payment UI when OTP is verified but payment not completed
  const showPaymentUI = shipment.status === 'arrived' && 
                        shipment.otp_verified_at && 
                        shipment.payment_status !== 'completed' &&
                        shipment.revenue && shipment.revenue > 0

  // Handle payment - redirect to PhonePe Standard Checkout
  const handlePayment = async () => {
    setIsProcessingPayment(true)
    setPaymentError(null)

    try {
      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId: shipment.id }),
      })

      const result = await response.json()

      if (result.success && result.redirectUrl) {
        // Redirect to PhonePe payment page
        window.location.href = result.redirectUrl
      } else {
        setPaymentError(result.error || 'Failed to initiate payment')
        setIsProcessingPayment(false)
      }
    } catch (error) {
      setPaymentError('Failed to connect to payment gateway')
      setIsProcessingPayment(false)
    }
  }

  // Fetch current location for in-transit shipments
  useEffect(() => {
    if (shipment.status === 'in_transit' && shipment.vehicles?.latitude && shipment.vehicles?.longitude) {
      // Reverse geocode
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${shipment.vehicles.longitude},${shipment.vehicles.latitude}.json?types=place,locality&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`
      )
        .then(res => res.json())
        .then(data => {
          if (data.features && data.features.length > 0) {
            setCurrentLocation(data.features[0].text || 'En route')
          }
        })
        .catch(() => setCurrentLocation('En route'))
    } else if (shipment.status === 'arrived') {
      setCurrentLocation(shipment.destination.split(',')[0])
    } else if (shipment.status === 'delivered') {
      setCurrentLocation('Delivered')
    } else {
      setCurrentLocation(shipment.start_location.split(',')[0])
    }
  }, [shipment])

  return (
    <Card className={`overflow-hidden transition-all ${showOTP ? 'border-orange-400 border-2 shadow-lg' : ''}`}>
      {/* Status Header Bar */}
      <div className={`bg-gradient-to-r ${statusConfig.bgGradient} text-white px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5" />
            <span className="font-semibold">{statusConfig.label}</span>
          </div>
          <span className="text-sm opacity-90 font-mono">{shipment.shipment_number}</span>
        </div>
        <p className="text-sm opacity-80 mt-1">{statusConfig.description}</p>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* OTP Display - Prominent when driver has arrived */}
        {showOTP && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 -mt-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-orange-600" />
              <span className="font-bold text-orange-800">🔐 Delivery Verification Code</span>
            </div>
            <div className="bg-white rounded-lg py-3 px-4 shadow-inner">
              <p className="text-4xl font-mono font-bold text-center text-orange-900 tracking-[0.4em]">
                {shipment.delivery_otp}
              </p>
            </div>
            <p className="text-xs text-orange-700 text-center mt-2">
              Share this code with your driver to confirm delivery
            </p>
          </div>
        )}

        {/* UPI Payment UI - Show when OTP verified but not paid */}
        {showPaymentUI && (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Wallet className="h-5 w-5 text-green-600" />
              <span className="font-bold text-green-800">💳 Complete Payment</span>
            </div>
            
            <div className="bg-white rounded-lg p-3 mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Amount to Pay</span>
                <span className="text-2xl font-bold text-green-700">₹{shipment.revenue?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-center text-gray-600">
                Pay securely using UPI, Credit/Debit Cards, or Net Banking
              </p>

              <Button 
                onClick={handlePayment} 
                disabled={isProcessingPayment}
                className="w-full bg-purple-600 hover:bg-purple-700 h-14 text-lg"
                size="lg"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Connecting to PhonePe...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Pay ₹{shipment.revenue?.toLocaleString('en-IN')}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-gray-500">
                Powered by PhonePe Payment Gateway
              </p>

              {paymentError && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-100 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{paymentError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Current Location */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
            <Navigation className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Current Location</p>
            <p className="font-semibold">{currentLocation || 'Fetching...'}</p>
          </div>
          {shipment.vehicles?.eta && shipment.status === 'in_transit' && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">ETA</p>
              <p className="font-semibold text-sm">
                {new Date(shipment.vehicles.eta).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}
        </div>

        {/* Route Summary */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">From</span>
            </div>
            <p className="text-sm font-medium truncate">{shipment.start_location.split(',')[0]}</p>
          </div>
          <div className="flex-shrink-0 w-8 h-0.5 bg-gray-200 relative">
            <div 
              className={`absolute top-0 left-0 h-full bg-gradient-to-r ${statusConfig.bgGradient}`}
              style={{ 
                width: shipment.status === "delivered" ? "100%" : 
                       shipment.status === "arrived" ? "80%" :
                       shipment.status === "in_transit" ? "50%" : "20%" 
              }}
            />
          </div>
          <div className="flex-1 text-right">
            <div className="flex items-center justify-end gap-1 mb-1">
              <span className="text-xs text-muted-foreground">To</span>
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <p className="text-sm font-medium truncate">{shipment.destination.split(',')[0]}</p>
          </div>
        </div>

        {/* Download Invoice Button for delivered shipments */}
        {shipment.status === 'delivered' && shipment.payment_status === 'completed' && customerName && customerPhone && (
          <div className="pt-2">
            <DownloadInvoiceButton 
              shipment={shipment}
              customerName={customerName}
              customerPhone={customerPhone}
            />
          </div>
        )}

        {/* Payment Status (for arrived shipments) */}
        {(shipment.status === 'arrived' || shipment.status === 'delivered') && shipment.revenue && (
          <div className="flex items-center justify-between py-2 border-t border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <span className="font-bold">₹{shipment.revenue.toLocaleString('en-IN')}</span>
            </div>
            {getPaymentStatusBadge(shipment.payment_status)}
          </div>
        )}

        {/* Expand/Collapse Toggle */}
        <Button 
          variant="ghost" 
          className="w-full justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-sm">{isExpanded ? 'Hide Details' : 'View Details'}</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-4 pt-2 border-t">
            {/* Timeline */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Tracking Timeline</p>
              <div className="space-y-0">
                {timelineSteps.map((step, index) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`p-1.5 rounded-full ${
                        step.status === 'completed' ? 'bg-green-500 text-white' :
                        step.status === 'current' ? 'bg-blue-500 text-white animate-pulse' :
                        step.status === 'cancelled' ? 'bg-red-500 text-white' :
                        'bg-gray-200 text-gray-400'
                      }`}>
                        {step.icon}
                      </div>
                      {index < timelineSteps.length - 1 && (
                        <div className={`w-0.5 h-8 ${
                          step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={`font-medium text-sm ${
                        step.status === 'upcoming' ? 'text-gray-400' : ''
                      }`}>{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      {step.time && (
                        <p className="text-xs text-muted-foreground mt-0.5">{step.time}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver Info */}
            {shipment.drivers && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2">Driver</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Truck className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{shipment.drivers.name}</p>
                      {shipment.vehicles && (
                        <p className="text-xs text-muted-foreground">
                          {shipment.vehicles.license_plate}
                        </p>
                      )}
                    </div>
                  </div>
                  {shipment.drivers.phone && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${shipment.drivers.phone}`}>
                        <Phone className="h-3 w-3 mr-1" />
                        Call
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Full Addresses */}
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Pickup Address</p>
                <p>{shipment.start_location}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivery Address</p>
                <p>{shipment.destination}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function CustomerDashboardPage() {
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerSession | null>(null)
  const [shipments, setShipments] = useState<ShipmentWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchShipments = useCallback(async (customerId: string) => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('shipments')
      .select('*, drivers(*), vehicles(*), customers(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setShipments(data as ShipmentWithRelations[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // Check for customer session
    const storedCustomer = localStorage.getItem('customer')
    if (!storedCustomer) {
      router.push('/customer/login')
      return
    }

    const customerData = JSON.parse(storedCustomer) as CustomerSession
    setCustomer(customerData)
    fetchShipments(customerData.id)

    // Set up realtime subscription for shipment updates
    const supabase = createClient()
    const channel = supabase
      .channel('customer-shipments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `customer_id=eq.${customerData.id}`,
        },
        () => {
          fetchShipments(customerData.id)
        }
      )
      .subscribe()

    // Also subscribe to vehicle updates for live tracking
    const vehicleChannel = supabase
      .channel('vehicle-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vehicles',
        },
        () => {
          fetchShipments(customerData.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(vehicleChannel)
    }
  }, [router, fetchShipments])

  const handleLogout = () => {
    localStorage.removeItem('customer')
    router.push('/login')
  }

  const handleRefresh = () => {
    if (customer) {
      setIsLoading(true)
      fetchShipments(customer.id)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading your shipments...</p>
        </div>
      </div>
    )
  }

  // Separate active and completed shipments
  const activeShipments = shipments.filter(s => 
    ['pending', 'in_transit', 'arrived'].includes(s.status)
  )
  const completedShipments = shipments.filter(s => 
    ['delivered', 'cancelled'].includes(s.status)
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-xl">My Shipments</h1>
              <p className="text-sm text-muted-foreground">Welcome, {customer?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Nova Care Call Button */}
          {customer && (
            <div className="mt-3 pt-3 border-t">
              <CallNovaButton 
                customerPhone={customer.phone} 
                customerName={customer.name}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {shipments.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-xl font-semibold mb-2">No shipments yet</p>
              <p className="text-muted-foreground">
                Your shipments will appear here once created
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Active Shipments */}
            {activeShipments.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Active Shipments ({activeShipments.length})
                </h2>
                <div className="space-y-4">
                  {activeShipments.map((shipment) => (
                    <ShipmentCard 
                      key={shipment.id} 
                      shipment={shipment} 
                      onPaymentComplete={() => customer && fetchShipments(customer.id)}
                      customerName={customer?.name}
                      customerPhone={customer?.phone}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Shipments */}
            {completedShipments.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Past Shipments ({completedShipments.length})
                </h2>
                <div className="space-y-4">
                  {completedShipments.map((shipment) => (
                    <ShipmentCard 
                      key={shipment.id} 
                      shipment={shipment}
                      customerName={customer?.name}
                      customerPhone={customer?.phone}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
