'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from './input'
import { MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LocationResult {
  id: string
  place_name: string
  center: [number, number] // [lng, lat]
}

interface LocationAutocompleteProps {
  id: string
  name: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  onLocationSelect?: (location: {
    address: string
    lat: number
    lng: number
  }) => void
  className?: string
}

export function LocationAutocomplete({
  id,
  name,
  placeholder = 'Search for a location...',
  required = false,
  defaultValue = '',
  onLocationSelect,
  className,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue)
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string
    lat: number
    lng: number
  } | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const searchLocations = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)

    try {
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${accessToken}&country=in&types=place,locality,neighborhood,address,poi&limit=5`
      )

      if (!response.ok) throw new Error('Failed to fetch locations')

      const data = await response.json()
      setResults(
        data.features.map((feature: { id: string; place_name: string; center: [number, number] }) => ({
          id: feature.id,
          place_name: feature.place_name,
          center: feature.center,
        }))
      )
      setIsOpen(true)
    } catch (error) {
      console.error('Error fetching locations:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setSelectedLocation(null)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchLocations(value)
    }, 300)
  }

  const handleSelectLocation = (result: LocationResult) => {
    const location = {
      address: result.place_name,
      lng: result.center[0],
      lat: result.center[1],
    }
    
    setQuery(result.place_name)
    setSelectedLocation(location)
    setIsOpen(false)
    setResults([])
    
    onLocationSelect?.(location)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          type="text"
          placeholder={placeholder}
          required={required}
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Hidden inputs for form submission */}
      <input type="hidden" name={`${name}_lat`} value={selectedLocation?.lat ?? ''} />
      <input type="hidden" name={`${name}_lng`} value={selectedLocation?.lng ?? ''} />

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {results.map((result) => (
              <li
                key={result.id}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSelectLocation(result)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{result.place_name}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
