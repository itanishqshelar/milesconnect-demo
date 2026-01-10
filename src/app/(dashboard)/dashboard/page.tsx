import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Truck, DollarSign, AlertTriangle, Activity, Clock } from 'lucide-react'
import { Shipment, Vehicle, Driver } from '@/lib/types/database'

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

  const allShipments = shipments || []
  const allVehicles = vehicles || []
  const allDrivers = drivers || []

  const totalShipments = allShipments.length
  const inTransit = allShipments.filter(s => s.status === 'in_transit').length
  const delivered = allShipments.filter(s => s.status === 'delivered').length
  const pending = allShipments.filter(s => s.status === 'pending').length

  const totalRevenue = allShipments
    .filter(s => s.status === 'delivered')
    .reduce((sum, s) => sum + (s.revenue || 0), 0)

  // Alerts: shipments pending for more than 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const alerts = allShipments.filter(
    s => s.status === 'pending' && s.created_at < oneDayAgo
  ).length

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

  return {
    totalShipments,
    inTransit,
    delivered,
    pending,
    totalRevenue,
    alerts,
    fleetUtilization,
    vehiclesInUse,
    totalVehicles,
    activeDrivers,
    totalDrivers,
    recentShipments,
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
            <div className="text-2xl font-bold text-orange-600">{stats.alerts}</div>
            <p className="text-xs text-muted-foreground">
              Shipments pending &gt;24 hours
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
