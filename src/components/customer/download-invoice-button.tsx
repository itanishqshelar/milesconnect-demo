'use client'

import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShipmentWithRelations } from '@/lib/types/database'
import { generateInvoice } from '@/lib/invoice/generate-invoice'

interface DownloadInvoiceButtonProps {
  shipment: ShipmentWithRelations
  customerName: string
  customerPhone: string
}

export function DownloadInvoiceButton({ 
  shipment, 
  customerName, 
  customerPhone 
}: DownloadInvoiceButtonProps) {
  const handleDownload = () => {
    generateInvoice({
      shipment,
      customerName,
      customerPhone,
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      className="gap-2"
    >
      <FileText className="h-4 w-4" />
      Download Invoice
    </Button>
  )
}
