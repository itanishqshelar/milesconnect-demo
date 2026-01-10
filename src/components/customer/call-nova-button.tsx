'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Phone, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { initiateRetellCall } from '@/lib/actions/retell'

interface CallNovaButtonProps {
  customerPhone: string
  customerName: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function CallNovaButton({ 
  customerPhone, 
  customerName, 
  variant = 'default',
  size = 'default',
  className = ''
}: CallNovaButtonProps) {
  const [status, setStatus] = useState<'idle' | 'calling' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleCall = async () => {
    setStatus('calling')
    setErrorMessage('')

    try {
      const result = await initiateRetellCall(customerPhone, customerName)
      
      if (result.error) {
        setStatus('error')
        setErrorMessage(result.error)
        // Reset after 3 seconds
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('success')
        // Reset after 5 seconds
        setTimeout(() => setStatus('idle'), 5000)
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage('Failed to initiate call')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant={status === 'error' ? 'destructive' : status === 'success' ? 'default' : variant}
        size={size}
        onClick={handleCall}
        disabled={status === 'calling'}
        className={`${className} ${status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}`}
      >
        {status === 'calling' ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Calling...
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            Call Initiated!
          </>
        ) : status === 'error' ? (
          <>
            <XCircle className="h-4 w-4 mr-2" />
            Failed
          </>
        ) : (
          <>
            <Phone className="h-4 w-4 mr-2" />
            Call Nova Care
          </>
        )}
      </Button>
      {status === 'error' && errorMessage && (
        <span className="text-xs text-red-500">{errorMessage}</span>
      )}
      {status === 'success' && (
        <span className="text-xs text-green-600">You will receive a call shortly</span>
      )}
    </div>
  )
}
