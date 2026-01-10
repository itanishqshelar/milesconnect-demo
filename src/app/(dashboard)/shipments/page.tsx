import { createClient } from '@/lib/supabase/server'
import { AddShipmentDialog } from '@/components/shipments/add-shipment-dialog'
import { ShipmentsTable } from '@/components/shipments/shipments-table'
import { ShipmentWithRelations, Driver, Vehicle } from '@/lib/types/database'

async function getShipments() {
  const supabase = await createClient()

  const { data: shipments } = await supabase
    .from('shipments')
    .select(`
      *,
      drivers (*),
      vehicles (*),
      customers (*)
    `)
    .order('created_at', { ascending: false }) as { data: ShipmentWithRelations[] | null }

  return shipments || []
}

async function getIdleDrivers() {
  const supabase = await createClient()

  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'idle')
    .order('name') as { data: Driver[] | null }

  return drivers || []
}

async function getIdleVehicles() {
  const supabase = await createClient()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('status', 'idle')
    .order('license_plate') as { data: Vehicle[] | null }

  return vehicles || []
}

export default async function ShipmentsPage() {
  const [shipments, idleDrivers, idleVehicles] = await Promise.all([
    getShipments(),
    getIdleDrivers(),
    getIdleVehicles(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
          <p className="text-muted-foreground">
            Manage and track all your shipments
          </p>
        </div>
        <AddShipmentDialog idleDrivers={idleDrivers} idleVehicles={idleVehicles} />
      </div>

      <ShipmentsTable shipments={shipments} />
    </div>
  )
}
