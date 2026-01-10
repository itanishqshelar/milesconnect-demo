"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Package, 
  MapPin, 
  Navigation, 
  LogOut, 
  RefreshCw,
  Loader2
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ShipmentWithRelations, Driver } from "@/lib/types/database"
import { AlertPanel } from "@/components/driver/alert-panel"

export default function DriverDashboardPage() {
  const router = useRouter()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [shipments, setShipments] = useState<ShipmentWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load driver from localStorage and fetch shipments
  useEffect(() => {
    const storedDriver = localStorage.getItem('driver')
    if (!storedDriver) {
      router.push('/driver/login')
      return
    }

    const driverData = JSON.parse(storedDriver) as Driver
    setDriver(driverData)
    fetchShipments(driverData.id)
  }, [router])

  const fetchShipments = async (driverId: string) => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('shipments')
      .select('*, drivers(*), vehicles(*)')
      .eq('driver_id', driverId)
      .in('status', ['pending', 'in_transit'])
      .order('created_at', { ascending: false })

    if (!error && data) {
      setShipments(data as ShipmentWithRelations[])
    }
    setIsLoading(false)
    setIsRefreshing(false)
  }

  const handleRefresh = () => {
    if (driver) {
      setIsRefreshing(true)
      fetchShipments(driver.id)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('driver')
    router.push('/driver/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'in_transit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">My Shipments</h1>
          <p className="text-sm text-muted-foreground">
            {driver?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Shipments List */}
      <main className="flex-1 p-4 space-y-4">
        {/* Alert Panel */}
        {driver && (
          <AlertPanel 
            driver={driver} 
            shipments={shipments}
            onAlertSent={handleRefresh}
          />
        )}

        {shipments.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No active shipments assigned</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={handleRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </Card>
        ) : (
          shipments.map((shipment) => (
            <Card 
              key={shipment.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/driver/shipment/${shipment.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    {shipment.shipment_number}
                  </CardTitle>
                  <Badge className={getStatusColor(shipment.status)}>
                    {shipment.status === 'in_transit' ? 'In Transit' : 'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Pickup */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-sm truncate">{shipment.start_location}</p>
                  </div>
                </div>

                {/* Connector line */}
                <div className="ml-1.5 h-4 w-0.5 bg-gray-200 dark:bg-gray-700" />

                {/* Destination */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <MapPin className="w-3 h-3 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Destination</p>
                    <p className="text-sm truncate">{shipment.destination}</p>
                  </div>
                </div>

                {/* Vehicle info */}
                {shipment.vehicles && (
                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Vehicle: {shipment.vehicles.license_plate}
                    </span>
                    <Navigation className="h-4 w-4 text-primary" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  )
}
