"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

interface WakeLockState {
  isSupported: boolean
  isActive: boolean
  error: string | null
}

export function useWakeLock() {
  const [state, setState] = useState<WakeLockState>({
    isSupported: false,
    isActive: false,
    error: null,
  })

  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Check support on mount
  useEffect(() => {
    const supported = 'wakeLock' in navigator
    setState((prev) => ({ ...prev, isSupported: supported }))
  }, [])

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setState((prev) => ({
        ...prev,
        error: 'Wake Lock API not supported',
      }))
      return false
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')

      wakeLockRef.current.addEventListener('release', () => {
        setState((prev) => ({ ...prev, isActive: false }))
      })

      setState((prev) => ({
        ...prev,
        isActive: true,
        error: null,
      }))

      return true
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to acquire wake lock'
      setState((prev) => ({
        ...prev,
        isActive: false,
        error,
      }))
      return false
    }
  }, [])

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
        setState((prev) => ({ ...prev, isActive: false }))
      } catch (err) {
        console.error('Failed to release wake lock:', err)
      }
    }
  }, [])

  // Re-acquire wake lock on visibility change (when screen turns back on)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === 'visible' &&
        state.isActive &&
        wakeLockRef.current === null
      ) {
        // Re-acquire wake lock when page becomes visible again
        await requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [state.isActive, requestWakeLock])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error)
      }
    }
  }, [])

  return {
    ...state,
    requestWakeLock,
    releaseWakeLock,
  }
}
