'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  AlertTriangle, 
  Clock, 
  X, 
  Check,
  Loader2,
  ChevronLeft,
  MapPin
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Driver, ShipmentWithRelations, AlertType } from '@/lib/types/database'

interface AlertPanelProps {
  driver: Driver
  shipments: ShipmentWithRelations[]
  onAlertSent?: () => void
}

const DELAY_ISSUES = [
  'Heavy Traffic',
  'Weather Conditions',
  'Road Block/Diversion',
  'Vehicle Breakdown',
  'Waiting at Pickup',
  'Other'
]

const EMERGENCY_ISSUES = [
  'Accident',
  'Medical Emergency',
  'Vehicle Failure',
  'Security Threat',
  'Cargo Damage',
  'Other'
]

export function AlertPanel({ driver, shipments, onAlertSent }: AlertPanelProps) {
  const [alertType, setAlertType] = useState<AlertType | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null)
  const [customMessage, setCustomMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Get location when emergency is selected
  useEffect(() => {
    if (alertType === 'emergency' && !location) {
      setIsGettingLocation(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
          setIsGettingLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          setIsGettingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [alertType, location])

  const issues = alertType === 'delay' ? DELAY_ISSUES : EMERGENCY_ISSUES

  const handleSubmit = async () => {
    if (!alertType || !selectedIssue) return

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      
      // Get the first active shipment for this driver
      const activeShipment = shipments.find(s => s.status === 'in_transit' || s.status === 'pending')
      
      const { error } = await supabase
        .from('driver_alerts')
        .insert({
          driver_id: driver.id,
          shipment_id: activeShipment?.id || null,
          alert_type: alertType,
          issue: selectedIssue,
          custom_message: selectedIssue === 'Other' ? customMessage : null,
          status: 'active',
          latitude: alertType === 'emergency' ? location?.lat || null : null,
          longitude: alertType === 'emergency' ? location?.lng || null : null,
        })

      if (error) {
        console.error('Error creating alert:', error)
        alert('Failed to send alert. Please try again.')
      } else {
        setSubmitted(true)
        setTimeout(() => {
          resetForm()
          onAlertSent?.()
        }, 2000)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to send alert. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setAlertType(null)
    setSelectedIssue(null)
    setCustomMessage('')
    setSubmitted(false)
    setLocation(null)
  }

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-3">
            <Check className="h-6 w-6 text-white" />
          </div>
          <p className="text-green-700 dark:text-green-300 font-medium">Alert Sent Successfully</p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            Admin has been notified
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!alertType) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Report Issue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3 border-orange-200 hover:bg-orange-50 hover:border-orange-300 dark:border-orange-800 dark:hover:bg-orange-950"
            onClick={() => setAlertType('delay')}
          >
            <Clock className="h-5 w-5 text-orange-500 mr-3" />
            <div className="text-left">
              <p className="font-medium">Report Delay</p>
              <p className="text-xs text-muted-foreground">Traffic, weather, or other delays</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-950"
            onClick={() => setAlertType('emergency')}
          >
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <div className="text-left">
              <p className="font-medium">Emergency</p>
              <p className="text-xs text-muted-foreground">Accident, breakdown, or urgent issue</p>
            </div>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={alertType === 'emergency' ? 'border-red-200 dark:border-red-800' : 'border-orange-200 dark:border-orange-800'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {alertType === 'emergency' ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>Report Emergency</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-orange-500" />
                <span>Report Delay</span>
              </>
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={resetForm}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!selectedIssue ? (
          <>
            <p className="text-sm text-muted-foreground mb-2">Select the issue:</p>
            <div className="grid gap-2">
              {issues.map((issue) => (
                <Button
                  key={issue}
                  variant="outline"
                  className="justify-start"
                  onClick={() => setSelectedIssue(issue)}
                >
                  {issue}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={resetForm}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={alertType === 'emergency' ? 'destructive' : 'secondary'}>
                {alertType === 'emergency' ? 'Emergency' : 'Delay'}
              </Badge>
              <span className="text-sm font-medium">{selectedIssue}</span>
            </div>

            {selectedIssue === 'Other' && (
              <div className="mb-3">
                <Input
                  placeholder="Describe the issue..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="mb-2"
                />
              </div>
            )}

            {alertType === 'emergency' && (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-red-500" />
                {isGettingLocation ? (
                  <span className="text-muted-foreground">Getting location...</span>
                ) : location ? (
                  <span className="text-green-600">Location captured</span>
                ) : (
                  <span className="text-orange-500">Location unavailable</span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedIssue(null)}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                className={alertType === 'emergency' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}
                onClick={handleSubmit}
                disabled={isSubmitting || (selectedIssue === 'Other' && !customMessage.trim())}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Alert'
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
