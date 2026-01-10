'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { syncVehicleDriverStatuses } from '@/lib/actions/vehicles'

export function SyncStatusButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSync() {
    setLoading(true)
    try {
      const result = await syncVehicleDriverStatuses()
      if (result.success) {
        const message = result.vehiclesFixed > 0 || result.driversFixed > 0
          ? `Fixed ${result.vehiclesFixed} vehicle(s) and ${result.driversFixed} driver(s)`
          : 'All statuses are already in sync'
        alert(message)
      }
      router.refresh()
    } catch (error) {
      console.error('Sync error:', error)
      alert('Failed to sync statuses')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      variant="outline" 
      onClick={handleSync} 
      disabled={loading}
      title="Sync vehicle and driver statuses with active shipments"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Syncing...' : 'Sync Status'}
    </Button>
  )
}
