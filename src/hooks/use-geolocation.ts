"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  isTracking: boolean
  lastUpdate: Date | null
}

interface UseGeolocationOptions {
  vehicleId: string | null
  updateIntervalMs?: number // Throttle interval (default 5000ms)
  enableHighAccuracy?: boolean
}

export function useGeolocation({
  vehicleId,
  updateIntervalMs = 5000,
  enableHighAccuracy = true,
}: UseGeolocationOptions) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isTracking: false,
    lastUpdate: null,
  })

  const watchIdRef = useRef<number | null>(null)
  const lastPushRef = useRef<number>(0)
  const supabase = createClient()

  // Push location to Supabase (throttled)
  const pushLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!vehicleId) return

      const now = Date.now()
      if (now - lastPushRef.current < updateIntervalMs) {
        return // Skip if too soon
      }
      lastPushRef.current = now

      try {
        const { error } = await supabase
          .from('vehicles')
          .update({
            latitude: lat,
            longitude: lng,
            last_location_update: new Date().toISOString(),
          })
          .eq('id', vehicleId)

        if (error) {
          console.error('Failed to push location:', error)
        } else {
          setState((prev) => ({ ...prev, lastUpdate: new Date() }))
        }
      } catch (err) {
        console.error('Location push error:', err)
      }
    },
    [vehicleId, updateIntervalMs, supabase]
  )

  // Set vehicle tracking mode
  const setTrackingMode = useCallback(
    async (mode: 'live' | 'simulated') => {
      if (!vehicleId) return

      try {
        await supabase
          .from('vehicles')
          .update({ tracking_mode: mode })
          .eq('id', vehicleId)
      } catch (err) {
        console.error('Failed to set tracking mode:', err)
      }
    },
    [vehicleId, supabase]
  )

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
      }))
      return
    }

    // Set to live tracking mode
    setTrackingMode('live')

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setState((prev) => ({
          ...prev,
          latitude,
          longitude,
          accuracy,
          error: null,
          isTracking: true,
        }))
        pushLocation(latitude, longitude)
      },
      (error) => {
        let errorMessage = 'Unknown error'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out'
            break
        }
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isTracking: false,
        }))
      },
      {
        enableHighAccuracy,
        maximumAge: 0,
        timeout: 10000,
      }
    )

    watchIdRef.current = watchId
    setState((prev) => ({ ...prev, isTracking: true }))
  }, [enableHighAccuracy, pushLocation, setTrackingMode])

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    // Revert to simulated mode
    setTrackingMode('simulated')

    setState((prev) => ({ ...prev, isTracking: false }))
  }, [setTrackingMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        // Revert to simulated mode on cleanup
        setTrackingMode('simulated')
      }
    }
  }, [setTrackingMode])

  return {
    ...state,
    startTracking,
    stopTracking,
  }
}
