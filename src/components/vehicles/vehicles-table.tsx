'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Vehicle, VehicleStatus } from '@/lib/types/database'
import { updateVehicle, deleteVehicle } from '@/lib/actions/vehicles'

interface VehiclesTableProps {
  vehicles: Vehicle[]
}

const vehicleTypes = ['Truck', 'Van', 'Trailer', 'Semi-Truck', 'Pickup']

function getStatusBadge(status: VehicleStatus) {
  switch (status) {
    case 'idle':
      return <Badge className="bg-green-500 hover:bg-green-600">Idle</Badge>
    case 'in_use':
      return <Badge className="bg-orange-500 hover:bg-orange-600">In Use</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function VehiclesTable({ vehicles }: VehiclesTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleUpdate(formData: FormData) {
    if (!editingVehicle) return
    setLoading(editingVehicle.id)
    setError(null)

    const result = await updateVehicle(editingVehicle.id, formData)

    if (result.error) {
      setError(result.error)
      setLoading(null)
      return
    }

    setLoading(null)
    setEditingVehicle(null)
    router.refresh()
  }

  async function handleDelete(vehicleId: string) {
    if (!confirm('Are you sure you want to delete this vehicle?')) return
    setLoading(vehicleId)
    setError(null)

    const result = await deleteVehicle(vehicleId)

    if (result.error) {
      alert(result.error)
      setLoading(null)
      return
    }

    setLoading(null)
    router.refresh()
  }

  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">No vehicles yet</p>
        <p className="text-sm text-muted-foreground">Add your first vehicle to get started</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>License Plate</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell className="font-medium">{vehicle.license_plate}</TableCell>
                <TableCell>{vehicle.type}</TableCell>
                <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                <TableCell>{formatDate(vehicle.created_at)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading === vehicle.id}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditingVehicle(vehicle)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(vehicle.id)}
                        className="text-red-600"
                        disabled={vehicle.status === 'in_use'}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
            <DialogDescription>
              Update vehicle information.
            </DialogDescription>
          </DialogHeader>

          <form action={handleUpdate} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Vehicle Type</Label>
                <Select name="type" defaultValue={editingVehicle?.type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-license_plate">License Plate</Label>
                <Input
                  id="edit-license_plate"
                  name="license_plate"
                  defaultValue={editingVehicle?.license_plate}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingVehicle(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading === editingVehicle?.id}>
                {loading === editingVehicle?.id ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
