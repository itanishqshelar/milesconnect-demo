import { createClient } from '@/lib/supabase/server'
import { FleetMapClient } from '@/components/fleetmap/fleet-map-client'
import { Vehicle, ShipmentWithRelations } from '@/lib/types/database'

async function getVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient()
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('license_plate')
  return vehicles || []
}

async function getActiveShipments(): Promise<ShipmentWithRelations[]> {
  const supabase = await createClient()
  const { data: shipments } = await supabase
    .from('shipments')
    .select('*, drivers(*), vehicles(*)')
    .eq('status', 'in_transit')
    .order('created_at', { ascending: false })
  return shipments || []
}

export default async function FleetMapPage() {
  const [vehicles, activeShipments] = await Promise.all([
    getVehicles(),
    getActiveShipments(),
  ])

  return (
    <div className="absolute inset-0 -m-6">
      <FleetMapClient 
        initialVehicles={vehicles} 
        activeShipments={activeShipments} 
      />
    </div>
  )
}
