'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import { clearAllAlerts } from '@/lib/actions/alerts'
import { useRouter } from 'next/navigation'

export function ClearAlertsButton() {
  const [isClearing, setIsClearing] = useState(false)
  const router = useRouter()

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all active alerts?')) return
    
    setIsClearing(true)
    try {
      const result = await clearAllAlerts()
      if (result.error) {
        alert('Failed to clear alerts: ' + result.error)
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error clearing alerts:', error)
      alert('Failed to clear alerts')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleClearAll}
      disabled={isClearing}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      {isClearing ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Clearing...
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All
        </>
      )}
    </Button>
  )
}
