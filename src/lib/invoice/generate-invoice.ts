import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ShipmentWithRelations } from '@/lib/types/database'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
  }
}

interface InvoiceData {
  shipment: ShipmentWithRelations
  customerName: string
  customerPhone: string
}

export function generateInvoice({ shipment, customerName, customerPhone }: InvoiceData): void {
  const doc = new jsPDF()
  
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246] // Blue-500
  const textColor: [number, number, number] = [31, 41, 55] // Gray-800
  const mutedColor: [number, number, number] = [107, 114, 128] // Gray-500
  
  // Header - Company Name
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, pageWidth, 40, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('MilesConnect', 20, 25)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Fleet Management & Logistics', 20, 33)
  
  // Invoice Title
  doc.setTextColor(...textColor)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', pageWidth - 20, 60, { align: 'right' })
  
  // Invoice Details (right side)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mutedColor)
  
  const invoiceNumber = `INV-${shipment.shipment_number}`
  const invoiceDate = shipment.delivered_at 
    ? new Date(shipment.delivered_at).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      })
    : new Date(shipment.created_at).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      })
  
  doc.text(`Invoice No: ${invoiceNumber}`, pageWidth - 20, 70, { align: 'right' })
  doc.text(`Date: ${invoiceDate}`, pageWidth - 20, 77, { align: 'right' })
  doc.text(`Payment Status: ${shipment.payment_status === 'completed' ? 'PAID' : 'PENDING'}`, pageWidth - 20, 84, { align: 'right' })
  
  // Bill To Section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...primaryColor)
  doc.text('Bill To:', 20, 60)
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textColor)
  doc.text(customerName, 20, 68)
  doc.setFontSize(10)
  doc.setTextColor(...mutedColor)
  doc.text(`Phone: ${customerPhone}`, 20, 75)
  
  // Shipment Details Section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...primaryColor)
  doc.text('Shipment Details', 20, 100)
  
  // Shipment Info Table
  autoTable(doc, {
    startY: 105,
    head: [['Description', 'Details']],
    body: [
      ['Shipment Number', shipment.shipment_number],
      ['Pickup Location', shipment.start_location],
      ['Delivery Location', shipment.destination],
      ['Driver', shipment.drivers?.name || 'Not Assigned'],
      ['Vehicle', shipment.vehicles?.license_plate || 'Not Assigned'],
      ['Created Date', new Date(shipment.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })],
      ['Delivered Date', shipment.delivered_at 
        ? new Date(shipment.delivered_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A'
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
    },
  })
  
  // Amount Section
  const finalY = doc.lastAutoTable.finalY + 15
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...primaryColor)
  doc.text('Payment Summary', 20, finalY)
  
  // Amount Table
  const amount = shipment.revenue || 0
  const formattedAmount = `₹${amount.toLocaleString('en-IN')}`
  
  autoTable(doc, {
    startY: finalY + 5,
    body: [
      ['Shipment Charge', formattedAmount],
      ['GST (0%)', '₹0'],
      ['Total Amount', formattedAmount],
    ],
    theme: 'plain',
    styles: {
      fontSize: 11,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [243, 244, 246] // Gray-100
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 12
      }
    },
  })
  
  // Payment Confirmation (if paid)
  if (shipment.payment_status === 'completed') {
    const paymentY = doc.lastAutoTable.finalY + 15
    
    doc.setFillColor(220, 252, 231) // Green-100
    doc.roundedRect(20, paymentY, pageWidth - 40, 25, 3, 3, 'F')
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 163, 74) // Green-600
    doc.text('✓ Payment Completed', 30, paymentY + 10)
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(21, 128, 61) // Green-700
    if (shipment.payment_transaction_id) {
      doc.text(`Transaction ID: ${shipment.payment_transaction_id}`, 30, paymentY + 18)
    }
    if (shipment.payment_completed_at) {
      const paymentDate = new Date(shipment.payment_completed_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      doc.text(`Paid on: ${paymentDate}`, 100, paymentY + 18)
    }
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 30
  
  doc.setDrawColor(...mutedColor)
  doc.setLineWidth(0.5)
  doc.line(20, footerY - 10, pageWidth - 20, footerY - 10)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mutedColor)
  doc.text('Thank you for choosing MilesConnect!', pageWidth / 2, footerY, { align: 'center' })
  doc.text('For queries, contact support@milesconnect.in', pageWidth / 2, footerY + 7, { align: 'center' })
  
  // Download the PDF
  const fileName = `Invoice_${shipment.shipment_number}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}
