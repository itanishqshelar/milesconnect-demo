import { createClient } from '@/lib/supabase/server'
import { AddDriverDialog } from '@/components/drivers/add-driver-dialog'
import { DriversTable } from '@/components/drivers/drivers-table'
import { Driver } from '@/lib/types/database'

async function getDrivers() {
  const supabase = await createClient()

  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .order('name') as { data: Driver[] | null }

  return drivers || []
}

export default async function DriversPage() {
  const drivers = await getDrivers()

  const idleCount = drivers.filter(d => d.status === 'idle').length
  const workingCount = drivers.filter(d => d.status === 'working').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drivers</h1>
          <p className="text-muted-foreground">
            {drivers.length} total drivers • {idleCount} idle • {workingCount} working
          </p>
        </div>
        <AddDriverDialog />
      </div>

      <DriversTable drivers={drivers} />
    </div>
  )
}
