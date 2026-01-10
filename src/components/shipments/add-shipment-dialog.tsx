'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { createShipment } from '@/lib/actions/shipments'
import { Driver, Vehicle } from '@/lib/types/database'

interface AddShipmentDialogProps {
  idleDrivers: Driver[]
  idleVehicles: Vehicle[]
}

export function AddShipmentDialog({ idleDrivers, idleVehicles }: AddShipmentDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await createShipment(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  const canCreateShipment = idleDrivers.length > 0 && idleVehicles.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Shipment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Shipment</DialogTitle>
          <DialogDescription>
            Add a new shipment to the system. Only idle drivers and vehicles are available.
          </DialogDescription>
        </DialogHeader>

        {!canCreateShipment ? (
          <div className="py-4 text-center text-muted-foreground">
            {idleDrivers.length === 0 && <p>No idle drivers available.</p>}
            {idleVehicles.length === 0 && <p>No idle vehicles available.</p>}
            <p className="mt-2 text-sm">Add more drivers or vehicles, or wait for current shipments to complete.</p>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_location">Start Location</Label>
                <LocationAutocomplete
                  id="start_location"
                  name="start_location"
                  placeholder="Search for start location in India..."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="destination">Destination</Label>
                <LocationAutocomplete
                  id="destination"
                  name="destination"
                  placeholder="Search for destination in India..."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="driver_id">Assign Driver</Label>
                <Select name="driver_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {idleDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vehicle_id">Assign Vehicle</Label>
                <Select name="vehicle_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {idleVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.type} - {vehicle.license_plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="revenue">Revenue ($)</Label>
                <Input
                  id="revenue"
                  name="revenue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Shipment'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
