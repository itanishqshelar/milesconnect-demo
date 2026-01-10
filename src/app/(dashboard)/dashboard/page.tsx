import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Truck, DollarSign, AlertTriangle, Activity, Clock, Bell, MapPin } from 'lucide-react'
import { Shipment, Vehicle, Driver, DriverAlertWithRelations } from '@/lib/types/database'
import { ClearAlertsButton } from '@/components/dashboard/clear-alerts-button'

async function getDashboardStats() {
  const supabase = await createClient()

  // Get all shipments
  const { data: shipments } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false }) as { data: Shipment[] | null }

  // Get all vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*') as { data: Vehicle[] | null }

  // Get all drivers
  const { data: drivers } = await supabase
    .from('drivers')
    .select('*') as { data: Driver[] | null }

  // Get recent driver alerts
  const { data: driverAlerts } = await supabase
    .from('driver_alerts')
    .select(`
      *,
      drivers (*),
      shipments (*)
    `)
    .order('created_at', { ascending: false })
    .limit(10) as { data: DriverAlertWithRelations[] | null }

  const allShipments = shipments || []
  const allVehicles = vehicles || []
  const allDrivers = drivers || []
  const allAlerts = driverAlerts || []

  const totalShipments = allShipments.length
  const inTransit = allShipments.filter(s => s.status === 'in_transit').length
  const delivered = allShipments.filter(s => s.status === 'delivered').length
  const pending = allShipments.filter(s => s.status === 'pending').length

  const totalRevenue = allShipments
    .filter(s => s.status === 'delivered')
    .reduce((sum, s) => sum + (s.revenue || 0), 0)

  // Alerts: shipments pending for more than 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const pendingAlerts = allShipments.filter(
    s => s.status === 'pending' && s.created_at < oneDayAgo
  ).length
  
  // Active driver alerts (delay/emergency)
  const activeDriverAlerts = allAlerts.filter(a => a.status === 'active').length

  // Fleet utilization: percentage of vehicles in use
  const vehiclesInUse = allVehicles.filter(v => v.status === 'in_use').length
  const totalVehicles = allVehicles.length
  const fleetUtilization = totalVehicles > 0 
    ? Math.round((vehiclesInUse / totalVehicles) * 100) 
    : 0

  // Active drivers
  const activeDrivers = allDrivers.filter(d => d.status === 'working').length
  const totalDrivers = allDrivers.length

  // Recent activity (last 5 shipments)
  const recentShipments = allShipments.slice(0, 5)
  
  // Recent alerts for activity feed
  const recentAlerts = allAlerts.slice(0, 5)

  return {
    totalShipments,
    inTransit,
    delivered,
    pending,
    totalRevenue,
    pendingAlerts,
    activeDriverAlerts,
    fleetUtilization,
    vehiclesInUse,
    totalVehicles,
    activeDrivers,
    totalDrivers,
    recentShipments,
    recentAlerts,
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-green-500'
    case 'in_transit':
      return 'bg-blue-500'
    case 'pending':
      return 'bg-yellow-500'
    case 'cancelled':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to MilesConnect fleet tracking system
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShipments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pending} pending, {stats.inTransit} in transit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inTransit}</div>
            <p className="text-xs text-muted-foreground">
              Active shipments on the road
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            <p className="text-xs text-muted-foreground">
              Successfully completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From delivered shipments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingAlerts + stats.activeDriverAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeDriverAlerts} driver alerts, {stats.pendingAlerts} pending &gt;24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fleetUtilization}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.vehiclesInUse} of {stats.totalVehicles} vehicles in use
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDrivers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeDrivers} of {stats.totalDrivers} drivers working
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Driver Alerts */}
      {stats.recentAlerts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  Driver Alerts
                </CardTitle>
                <CardDescription>Recent delay and emergency reports from drivers</CardDescription>
              </div>
              {stats.activeDriverAlerts > 0 && <ClearAlertsButton />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 ${
                    alert.status === 'active' ? 'bg-orange-50 dark:bg-orange-950/20 -mx-2 px-2 py-2 rounded' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${
                      alert.alert_type === 'emergency' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
                    }`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{alert.issue}</p>
                        <Badge 
                          variant={alert.alert_type === 'emergency' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {alert.alert_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {alert.drivers?.name || 'Unknown Driver'}
                        {alert.shipments && ` • ${alert.shipments.shipment_number}`}
                        {alert.custom_message && ` - "${alert.custom_message}"`}
                      </p>
                      {alert.alert_type === 'emergency' && alert.latitude && alert.longitude && (
                        <a 
                          href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                        >
                          <MapPin className="h-3 w-3" />
                          View Location ({alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)})
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant="outline" 
                      className={`capitalize ${
                        alert.status === 'active' 
                          ? 'border-orange-500 text-orange-600' 
                          : alert.status === 'acknowledged'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-green-500 text-green-600'
                      }`}
                    >
                      {alert.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(alert.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest shipment updates</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentShipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shipments yet</p>
          ) : (
            <div className="space-y-4">
              {stats.recentShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(shipment.status)}`} />
                    <div>
                      <p className="text-sm font-medium">{shipment.shipment_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {shipment.start_location} → {shipment.destination}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="capitalize">
                      {shipment.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(shipment.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
