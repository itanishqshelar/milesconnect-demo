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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Driver, DriverStatus } from '@/lib/types/database'
import { updateDriver, deleteDriver } from '@/lib/actions/drivers'

interface DriversTableProps {
  drivers: Driver[]
}

function getStatusBadge(status: DriverStatus) {
  switch (status) {
    case 'idle':
      return <Badge className="bg-green-500 hover:bg-green-600">Idle</Badge>
    case 'working':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Working</Badge>
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

export function DriversTable({ drivers }: DriversTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleUpdate(formData: FormData) {
    if (!editingDriver) return
    setLoading(editingDriver.id)
    setError(null)

    const result = await updateDriver(editingDriver.id, formData)

    if (result.error) {
      setError(result.error)
      setLoading(null)
      return
    }

    setLoading(null)
    setEditingDriver(null)
    router.refresh()
  }

  async function handleDelete(driverId: string) {
    if (!confirm('Are you sure you want to delete this driver?')) return
    setLoading(driverId)
    setError(null)

    const result = await deleteDriver(driverId)

    if (result.error) {
      alert(result.error)
      setLoading(null)
      return
    }

    setLoading(null)
    router.refresh()
  }

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">No drivers yet</p>
        <p className="text-sm text-muted-foreground">Add your first driver to get started</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell className="font-medium">{driver.name}</TableCell>
                <TableCell>{driver.email || '-'}</TableCell>
                <TableCell>{driver.phone || '-'}</TableCell>
                <TableCell>{getStatusBadge(driver.status)}</TableCell>
                <TableCell>{formatDate(driver.created_at)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading === driver.id}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditingDriver(driver)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(driver.id)}
                        className="text-red-600"
                        disabled={driver.status === 'working'}
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
      <Dialog open={!!editingDriver} onOpenChange={(open) => !open && setEditingDriver(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
            <DialogDescription>
              Update driver information.
            </DialogDescription>
          </DialogHeader>

          <form action={handleUpdate} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingDriver?.name}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  name="email"
                  type="email"
                  defaultValue={editingDriver?.email || ''}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  name="phone"
                  type="tel"
                  defaultValue={editingDriver?.phone || ''}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingDriver(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading === editingDriver?.id}>
                {loading === editingDriver?.id ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
