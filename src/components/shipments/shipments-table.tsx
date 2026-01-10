'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MoreHorizontal, Truck, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { ShipmentWithRelations, ShipmentStatus } from '@/lib/types/database'
import { updateShipmentStatus, deleteShipment } from '@/lib/actions/shipments'

interface ShipmentsTableProps {
  shipments: ShipmentWithRelations[]
}

function getStatusBadge(status: ShipmentStatus) {
  switch (status) {
    case 'delivered':
      return <Badge className="bg-green-500 hover:bg-green-600">Delivered</Badge>
    case 'in_transit':
      return <Badge className="bg-blue-500 hover:bg-blue-600">In Transit</Badge>
    case 'pending':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>
    case 'cancelled':
      return <Badge className="bg-red-500 hover:bg-red-600">Cancelled</Badge>
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

function formatCurrency(amount: number | null): string {
  if (amount === null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function ShipmentsTable({ shipments }: ShipmentsTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function handleStatusChange(shipmentId: string, newStatus: ShipmentStatus) {
    setLoading(shipmentId)
    await updateShipmentStatus(shipmentId, newStatus)
    setLoading(null)
    router.refresh()
  }

  async function handleDelete(shipmentId: string) {
    if (!confirm('Are you sure you want to delete this shipment?')) return
    setLoading(shipmentId)
    await deleteShipment(shipmentId)
    setLoading(null)
    router.refresh()
  }

  if (shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">No shipments yet</p>
        <p className="text-sm text-muted-foreground">Create your first shipment to get started</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment #</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow key={shipment.id}>
              <TableCell className="font-medium">{shipment.shipment_number}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm">{shipment.start_location}</span>
                  <span className="text-xs text-muted-foreground">→ {shipment.destination}</span>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(shipment.status)}</TableCell>
              <TableCell>{shipment.drivers?.name || '-'}</TableCell>
              <TableCell>
                {shipment.vehicles 
                  ? `${shipment.vehicles.type} (${shipment.vehicles.license_plate})`
                  : '-'
                }
              </TableCell>
              <TableCell>{formatCurrency(shipment.revenue)}</TableCell>
              <TableCell>{formatDate(shipment.created_at)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading === shipment.id}>
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {shipment.status === 'pending' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'in_transit')}>
                        <Truck className="mr-2 h-4 w-4" />
                        Start Transit
                      </DropdownMenuItem>
                    )}
                    {shipment.status === 'in_transit' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'delivered')}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark Delivered
                      </DropdownMenuItem>
                    )}
                    {(shipment.status === 'pending' || shipment.status === 'in_transit') && (
                      <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'cancelled')}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel Shipment
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleDelete(shipment.id)}
                      className="text-red-600"
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
  )
}
