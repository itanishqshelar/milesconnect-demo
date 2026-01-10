"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Package, Search, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TrackingView } from "@/components/track/tracking-view"
import { ShipmentWithRelations } from "@/lib/types/database"

export default function TrackShipmentPage() {
  const [shipmentId, setShipmentId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipment, setShipment] = useState<ShipmentWithRelations | null>(null)

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setShipment(null)

    try {
      const supabase = createClient()
      
      // Search by shipment number
      const { data, error: queryError } = await supabase
        .from('shipments')
        .select(`
          *,
          drivers (*),
          vehicles (*)
        `)
        .eq('shipment_number', shipmentId.toUpperCase().trim())
        .single()

      if (queryError || !data) {
        setError("Shipment not found. Please check your tracking ID and try again.")
        setIsLoading(false)
        return
      }

      setShipment(data as ShipmentWithRelations)
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewSearch = () => {
    setShipment(null)
    setShipmentId("")
    setError(null)
  }

  if (shipment) {
    return <TrackingView shipment={shipment} onNewSearch={handleNewSearch} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="flex justify-center mb-2">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Track Your Shipment</CardTitle>
          <CardDescription className="text-base text-gray-500">
            Enter your tracking ID to see the current status and location of your delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleTrack} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="shipmentId" className="text-sm font-medium text-gray-700">
                Tracking ID
              </Label>
              <Input
                id="shipmentId"
                type="text"
                placeholder="e.g., MC-20260109-001"
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
                required
                className="h-14 text-lg text-center font-mono tracking-wider border-2 border-gray-200 focus:border-blue-500 transition-colors"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md"
              disabled={isLoading || !shipmentId.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Track Shipment
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400">
              Your tracking ID is in your confirmation email or receipt
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
