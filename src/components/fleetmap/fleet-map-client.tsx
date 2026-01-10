'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { createClient } from '@/lib/supabase/client'
import { Vehicle, ShipmentWithRelations } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Square, Clock, MapPin, Navigation, ChevronLeft, ChevronRight, X, TrafficCone } from 'lucide-react'

// Set the Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ''

// Simulation interval in milliseconds (3 seconds for smoother movement)
const SIMULATION_INTERVAL_MS = 3000

interface FleetMapClientProps {
  initialVehicles: Vehicle[]
  activeShipments: ShipmentWithRelations[]
}

export function FleetMapClient({ initialVehicles, activeShipments }: FleetMapClientProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map())
  
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [isSimulating, setIsSimulating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [shipmentsPanelOpen, setShipmentsPanelOpen] = useState(false)
  const [showTraffic, setShowTraffic] = useState(true)
  const simulationInterval = useRef<NodeJS.Timeout | null>(null)
  const previousPositions = useRef<Map<string, { lat: number; lng: number }>>(new Map())

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [78.9629, 20.5937], // Center of India
      zoom: 4.5,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    // Add route layers when map loads
    map.current.on('load', () => {
      // Add Mapbox traffic source and layers for real-time traffic visualization
      map.current!.addSource('mapbox-traffic', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-traffic-v1',
      })

      // Traffic flow layer - shows traffic speed on roads
      map.current!.addLayer({
        id: 'traffic-flow',
        type: 'line',
        source: 'mapbox-traffic',
        'source-layer': 'traffic',
        minzoom: 6, // Only show traffic when zoomed in enough
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            6, 1,
            12, 3,
            18, 6
          ],
          'line-color': [
            'match',
            ['get', 'congestion'],
            'low', '#22c55e',      // Green - free flow
            'moderate', '#eab308', // Yellow - moderate
            'heavy', '#f97316',    // Orange - heavy
            'severe', '#dc2626',   // Red - severe/standstill
            '#9ca3af'              // Gray - unknown
          ],
          'line-opacity': 0.75,
        },
      })

      // Add source for routes
      map.current!.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add source for route endpoints (start/end markers)
      map.current!.addSource('route-endpoints', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      // Add route line layer with glow effect
      map.current!.addLayer({
        id: 'route-lines-glow',
        type: 'line',
        source: 'routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 8,
          'line-opacity': 0.3,
          'line-blur': 3,
        },
      })

      map.current!.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#60a5fa',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      })

      // Add start point markers (green circles)
      map.current!.addLayer({
        id: 'route-start-points',
        type: 'circle',
        source: 'route-endpoints',
        filter: ['==', ['get', 'type'], 'start'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#10b981',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add end point markers (red circles)
      map.current!.addLayer({
        id: 'route-end-points',
        type: 'circle',
        source: 'route-endpoints',
        filter: ['==', ['get', 'type'], 'end'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Add initial vehicles and routes
      updateMapMarkers(initialVehicles)
      updateRouteLines(initialVehicles)
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update markers when vehicles change
  const updateMapMarkers = useCallback((vehicleList: Vehicle[]) => {
    if (!map.current) return

    const activeVehicles = vehicleList.filter(v => v.latitude && v.longitude)
    const currentMarkerIds = new Set(markers.current.keys())
    const newMarkerIds = new Set(activeVehicles.map(v => v.id))

    // Remove markers that are no longer active
    currentMarkerIds.forEach(id => {
      if (!newMarkerIds.has(id)) {
        markers.current.get(id)?.remove()
        markers.current.delete(id)
        previousPositions.current.delete(id)
      }
    })

    // Add or update markers
    activeVehicles.forEach(vehicle => {
      const existingMarker = markers.current.get(vehicle.id)
      const shipment = activeShipments.find(s => s.vehicle_id === vehicle.id)
      
      // Calculate bearing/rotation based on movement direction
      const prevPos = previousPositions.current.get(vehicle.id)
      let bearing = 0
      if (prevPos && vehicle.latitude && vehicle.longitude) {
        const dLng = vehicle.longitude - prevPos.lng
        const dLat = vehicle.latitude - prevPos.lat
        if (Math.abs(dLng) > 0.0001 || Math.abs(dLat) > 0.0001) {
          bearing = Math.atan2(dLng, dLat) * (180 / Math.PI)
        }
      }
      
      // Store current position for next update
      if (vehicle.latitude && vehicle.longitude) {
        previousPositions.current.set(vehicle.id, { lat: vehicle.latitude, lng: vehicle.longitude })
      }
      
      // Check if marker is still valid (has element attached to DOM)
      const isMarkerValid = existingMarker && existingMarker.getElement()?.parentNode
      
      if (existingMarker && isMarkerValid) {
        try {
          // Update position with animation
          existingMarker.setLngLat([vehicle.longitude!, vehicle.latitude!])
          
          // Update rotation
          const el = existingMarker.getElement()
          if (el) {
            const arrow = el.querySelector('.vehicle-arrow') as HTMLElement
            if (arrow && bearing !== 0) {
              arrow.style.transform = `rotate(${bearing}deg)`
            }
          }
          
          // Update popup content
          const popup = existingMarker.getPopup()
          if (popup) {
            popup.setHTML(createPopupContent(vehicle, shipment))
          }
        } catch (error) {
          // Marker is stale, remove it and create a new one
          console.warn('Stale marker detected, recreating:', vehicle.id)
          markers.current.delete(vehicle.id)
        }
      } else if (existingMarker && !isMarkerValid) {
        // Marker exists but is invalid, remove from tracking
        markers.current.delete(vehicle.id)
      }
      
      // Create new marker if needed
      if (!markers.current.has(vehicle.id)) {
        // Create new marker with directional arrow
        const el = document.createElement('div')
        el.className = 'vehicle-marker-container'
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <!-- Pulse ring -->
            <div class="absolute w-14 h-14 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            <!-- Direction arrow indicator -->
            <div class="vehicle-arrow relative w-10 h-10 flex items-center justify-center transition-transform duration-500" style="transform: rotate(${bearing}deg)">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Arrow body with gradient -->
                <defs>
                  <linearGradient id="arrowGradient" x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#10b981"/>
                    <stop offset="100%" stop-color="#059669"/>
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <!-- Main arrow -->
                <path d="M20 4L32 32L20 26L8 32L20 4Z" fill="url(#arrowGradient)" stroke="white" stroke-width="2" filter="url(#glow)"/>
              </svg>
            </div>
            <!-- License plate label -->
            <div class="absolute -bottom-7 whitespace-nowrap bg-black/80 text-white text-[10px] px-2 py-0.5 rounded font-semibold shadow-lg backdrop-blur-sm">
              ${vehicle.license_plate}
            </div>
          </div>
        `

        // Add CSS for animation
        const style = document.createElement('style')
        style.textContent = `
          @keyframes ping {
            75%, 100% {
              transform: scale(2);
              opacity: 0;
            }
          }
          .animate-ping {
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
        `
        if (!document.head.querySelector('#vehicle-marker-styles')) {
          style.id = 'vehicle-marker-styles'
          document.head.appendChild(style)
        }

        const popup = new mapboxgl.Popup({ 
          offset: 25,
          className: 'vehicle-popup',
          closeButton: true,
          closeOnClick: false,
        }).setHTML(createPopupContent(vehicle, shipment))

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([vehicle.longitude!, vehicle.latitude!])
          .setPopup(popup)
          .addTo(map.current!)

        markers.current.set(vehicle.id, marker)
      }
    })
  }, [activeShipments])

  // Update route lines on map
  const updateRouteLines = useCallback((vehicleList: Vehicle[]) => {
    if (!map.current || !map.current.getSource('routes')) return

    const routeFeatures: GeoJSON.Feature[] = []
    const endpointFeatures: GeoJSON.Feature[] = []

    vehicleList
      .filter(v => v.current_route)
      .forEach(vehicle => {
        // Parse route data - handle both string and object formats from Supabase
        let routeData = vehicle.current_route
        if (typeof routeData === 'string') {
          try {
            routeData = JSON.parse(routeData)
          } catch {
            return
          }
        }
        
        if (!routeData || !routeData.coordinates || !Array.isArray(routeData.coordinates)) {
          return
        }

        const coordinates = routeData.coordinates

        // Add route line
        routeFeatures.push({
          type: 'Feature',
          properties: {
            vehicleId: vehicle.id,
          },
          geometry: {
            type: 'LineString',
            coordinates: coordinates,
          },
        })

        // Add start point
        if (coordinates.length > 0) {
          endpointFeatures.push({
            type: 'Feature',
            properties: {
              type: 'start',
              vehicleId: vehicle.id,
            },
            geometry: {
              type: 'Point',
              coordinates: coordinates[0],
            },
          })
        }

        // Add end point
        if (coordinates.length > 1) {
          endpointFeatures.push({
            type: 'Feature',
            properties: {
              type: 'end',
              vehicleId: vehicle.id,
            },
            geometry: {
              type: 'Point',
              coordinates: coordinates[coordinates.length - 1],
            },
          })
        }
      })

    // Update route lines
    const routeSource = map.current.getSource('routes') as mapboxgl.GeoJSONSource
    routeSource.setData({
      type: 'FeatureCollection',
      features: routeFeatures,
    })

    // Update endpoint markers
    const endpointSource = map.current.getSource('route-endpoints') as mapboxgl.GeoJSONSource
    if (endpointSource) {
      endpointSource.setData({
        type: 'FeatureCollection',
        features: endpointFeatures,
      })
    }
  }, [])

  // Create popup HTML content
  function createPopupContent(vehicle: Vehicle, shipment?: ShipmentWithRelations | null): string {
    const etaStr = vehicle.eta 
      ? new Date(vehicle.eta).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : 'N/A'
    
    // Calculate distance info from route
    let distanceStr = 'N/A'
    let progressPercent = 0
    if (vehicle.current_route) {
      let routeData = vehicle.current_route
      if (typeof routeData === 'string') {
        try {
          routeData = JSON.parse(routeData)
        } catch { /* ignore */ }
      }
      if (routeData && routeData.distance) {
        const totalKm = (routeData.distance / 1000).toFixed(1)
        const totalPoints = routeData.coordinates?.length || 1
        const currentIndex = vehicle.route_index || 0
        progressPercent = Math.round((currentIndex / totalPoints) * 100)
        const remainingKm = ((routeData.distance / 1000) * (1 - currentIndex / totalPoints)).toFixed(1)
        distanceStr = `${remainingKm} km left`
      }
    }
    
    return `
      <div class="p-3 min-w-[220px] bg-gray-900 text-white rounded-lg">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
          <div>
            <div class="font-bold text-sm">${vehicle.license_plate}</div>
            <div class="text-xs text-gray-400">${vehicle.type}</div>
          </div>
          <div class="ml-auto px-2 py-0.5 rounded text-xs font-medium ${vehicle.status === 'in_use' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}">
            ${vehicle.status === 'in_use' ? 'En Route' : 'Idle'}
          </div>
        </div>
        ${vehicle.status === 'in_use' ? `
        <div class="mb-2">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-gray-400">Progress</span>
            <span class="text-white">${progressPercent}%</span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-1.5">
            <div class="bg-emerald-500 h-1.5 rounded-full transition-all" style="width: ${progressPercent}%"></div>
          </div>
        </div>
        ` : ''}
        ${shipment ? `
          <div class="border-t border-gray-700 pt-2 mt-2">
            <div class="text-xs text-gray-400 mb-1">Shipment: <span class="text-white">${shipment.shipment_number}</span></div>
            <div class="text-xs space-y-1">
              <div class="flex items-start gap-2">
                <span class="text-emerald-400">●</span>
                <span class="text-gray-300">${shipment.start_location}</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="text-red-400">●</span>
                <span class="text-gray-300">${shipment.destination}</span>
              </div>
            </div>
          </div>
        ` : ''}
        <div class="border-t border-gray-700 pt-2 mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-gray-400">Distance</span>
            <div class="font-medium text-white">${distanceStr}</div>
          </div>
          <div class="text-right">
            <span class="text-gray-400">ETA</span>
            <div class="font-medium text-emerald-400">${etaStr}</div>
          </div>
        </div>
      </div>
    `
  }

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('vehicles-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vehicles',
        },
        (payload) => {
          const updatedVehicle = payload.new as Vehicle
          setVehicles(prev => {
            const newVehicles = prev.map(v => {
              if (v.id === updatedVehicle.id) {
                // Merge updated data, preserving current_route if not in update
                // Supabase realtime may not always include large JSONB fields
                return {
                  ...v,
                  ...updatedVehicle,
                  // Preserve route if the update doesn't include it or it's null
                  current_route: updatedVehicle.current_route ?? v.current_route,
                }
              }
              return v
            })
            // Update markers immediately on realtime update
            setTimeout(() => {
              updateMapMarkers(newVehicles)
              updateRouteLines(newVehicles)
            }, 0)
            return newVehicles
          })
          setLastUpdate(new Date())
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [updateMapMarkers, updateRouteLines])

  // Update markers when vehicles state changes
  useEffect(() => {
    updateMapMarkers(vehicles)
    updateRouteLines(vehicles)
  }, [vehicles, updateMapMarkers, updateRouteLines])

  // Simulation controls
  const startSimulation = () => {
    setIsSimulating(true)
    
    // Call simulation API immediately
    runSimulationStep()
    
    // Then continue at the configured interval for smooth movement
    simulationInterval.current = setInterval(runSimulationStep, SIMULATION_INTERVAL_MS)
  }

  const stopSimulation = () => {
    setIsSimulating(false)
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current)
      simulationInterval.current = null
    }
  }

  // Toggle traffic layer visibility
  const toggleTraffic = () => {
    if (map.current && map.current.getLayer('traffic-flow')) {
      const visibility = showTraffic ? 'none' : 'visible'
      map.current.setLayoutProperty('traffic-flow', 'visibility', visibility)
      setShowTraffic(!showTraffic)
    }
  }

  const runSimulationStep = async () => {
    try {
      const response = await fetch('/api/simulate', { method: 'POST' })
      if (!response.ok) {
        console.error('Simulation step failed')
      }
    } catch (error) {
      console.error('Simulation error:', error)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current)
      }
    }
  }, [])

  // Get active vehicle count
  const activeVehicleCount = vehicles.filter(v => v.status === 'in_use' && v.latitude && v.longitude).length
  const totalVehicles = vehicles.length

  const focusOnVehicle = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (vehicle?.latitude && vehicle?.longitude && map.current) {
      map.current.flyTo({
        center: [vehicle.longitude, vehicle.latitude],
        zoom: 14,
        duration: 1500,
      })
      // Open the marker popup
      setTimeout(() => {
        const marker = markers.current.get(vehicle.id)
        const popup = marker?.getPopup()
        if (marker && popup && !popup.isOpen()) {
          marker.togglePopup()
        }
      }, 1000)
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Full-page Map */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      {/* Bottom-left Fleet Tracking Panel */}
      <div className="absolute bottom-4 left-4 z-10">
        <Card className="bg-black/40 backdrop-blur-md shadow-2xl border-white/10">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Navigation className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base text-white">Fleet Tracking</CardTitle>
                <p className="text-xs text-white/60">Real-time positions</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-white/10 text-white border-white/20 gap-1.5 py-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                {activeVehicleCount} / {totalVehicles} Active
              </Badge>
              {lastUpdate && (
                <Badge className="bg-white/10 text-white/70 border-white/20 gap-1 py-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {lastUpdate.toLocaleTimeString()}
                </Badge>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {isSimulating ? (
                <Button variant="destructive" size="sm" className="flex-1" onClick={stopSimulation}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={startSimulation} disabled={activeVehicleCount === 0}>
                  <Play className="h-4 w-4 mr-2" />
                  Simulate
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className={`${showTraffic ? 'bg-orange-500/20 border-orange-400/50 text-orange-400' : 'bg-white/5 border-white/20 text-white'} hover:bg-orange-500/30 hover:text-orange-300`}
                onClick={toggleTraffic}
                title={showTraffic ? 'Hide Traffic' : 'Show Traffic'}
              >
                <TrafficCone className="h-4 w-4" />
              </Button>
              {activeShipments.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setShipmentsPanelOpen(true)}
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  {activeShipments.length}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Slide-out Shipments Panel */}
      <div 
        className={`absolute top-0 right-0 h-full z-20 transition-transform duration-300 ease-in-out ${
          shipmentsPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full w-80 bg-black/60 backdrop-blur-xl border-l border-white/10 shadow-2xl">
          {/* Panel Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-400" />
              <h2 className="font-semibold text-white">Active Shipments</h2>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0">{activeShipments.length}</Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
              onClick={() => setShipmentsPanelOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Shipments List */}
          <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-60px)]">
            {activeShipments.map(shipment => {
              const vehicle = vehicles.find(v => v.id === shipment.vehicle_id)
              return (
                <div 
                  key={shipment.id} 
                  className="p-4 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-all border border-white/10 hover:border-emerald-500/50"
                  onClick={() => {
                    if (vehicle) {
                      focusOnVehicle(vehicle.id)
                      setShipmentsPanelOpen(false)
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="font-semibold text-sm text-white">{shipment.shipment_number}</span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 shrink-0"></div>
                      <span className="text-xs text-white/70 leading-tight">{shipment.start_location}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0"></div>
                      <span className="text-xs text-white/70 leading-tight">{shipment.destination}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge className="bg-white/10 text-white/80 border-0 text-xs">
                      {vehicle?.license_plate || 'N/A'}
                    </Badge>
                    {vehicle?.eta && (
                      <span className="text-xs text-emerald-400 font-medium">
                        ETA: {new Date(vehicle.eta).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            
            {activeShipments.length === 0 && (
              <div className="text-center text-white/40 py-8">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active shipments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel Toggle Button (when closed) */}
      {!shipmentsPanelOpen && activeShipments.length > 0 && (
        <Button
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 backdrop-blur-md border-white/10 text-white hover:bg-black/60"
          variant="outline"
          size="icon"
          onClick={() => setShipmentsPanelOpen(true)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
