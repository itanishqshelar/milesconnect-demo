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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MoreHorizontal, Truck, CheckCircle, XCircle, Trash2, Eye, User, Phone, CreditCard, MapPin } from 'lucide-react'
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
    case 'arrived':
      return <Badge className="bg-orange-500 hover:bg-orange-600">Arrived</Badge>
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
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount)
}

export function ShipmentsTable({ shipments }: ShipmentsTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<ShipmentWithRelations | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
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

  function handleViewCustomer(shipment: ShipmentWithRelations) {
    console.log('Viewing customer for shipment:', shipment)
    console.log('Customer data:', shipment.customers)
    setSelectedShipment(shipment)
    setIsSheetOpen(true)
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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shipment #</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
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
                <TableCell>
                  {shipment.payment_status === 'completed' ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Paid
                    </Badge>
                  ) : shipment.payment_status === 'initiated' ? (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  ) : shipment.payment_status === 'failed' ? (
                    <Badge className="bg-red-100 text-red-800">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Failed
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
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
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleViewCustomer(shipment)}
                      disabled={!shipment.customers}
                      title={shipment.customers ? 'View customer details' : 'No customer linked'}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                        {shipment.status === 'arrived' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(shipment.id, 'delivered')}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Force Complete Delivery
                          </DropdownMenuItem>
                        )}
                        {(shipment.status === 'pending' || shipment.status === 'in_transit' || shipment.status === 'arrived') && (
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Customer Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Customer Details</SheetTitle>
            <SheetDescription>
              Information about the customer for shipment {selectedShipment?.shipment_number}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {selectedShipment?.customers ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Customer Name</p>
                    <p className="mt-1 text-lg font-semibold">{selectedShipment.customers.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                    <p className="mt-1 text-lg font-semibold">
                      <a 
                        href={`tel:${selectedShipment.customers.phone_number}`}
                        className="hover:underline"
                      >
                        {selectedShipment.customers.phone_number}
                      </a>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                <p>No customer information available for this shipment.</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
