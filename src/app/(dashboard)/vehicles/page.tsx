import { createClient } from '@/lib/supabase/server'
import { AddVehicleDialog } from '@/components/vehicles/add-vehicle-dialog'
import { VehiclesTable } from '@/components/vehicles/vehicles-table'
import { SyncStatusButton } from '@/components/vehicles/sync-status-button'
import { Vehicle } from '@/lib/types/database'

async function getVehicles() {
  const supabase = await createClient()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('license_plate') as { data: Vehicle[] | null }

  return vehicles || []
}

export default async function VehiclesPage() {
  const vehicles = await getVehicles()

  const idleCount = vehicles.filter(v => v.status === 'idle').length
  const inUseCount = vehicles.filter(v => v.status === 'in_use').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vehicles</h1>
          <p className="text-muted-foreground">
            {vehicles.length} total vehicles • {idleCount} idle • {inUseCount} in use
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusButton />
          <AddVehicleDialog />
        </div>
      </div>

      <VehiclesTable vehicles={vehicles} />
    </div>
  )
}
