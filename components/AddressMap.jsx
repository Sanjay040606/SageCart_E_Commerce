'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const DEFAULT_CENTER = [20.5937, 78.9629]

const MapIconFix = () => {
  useEffect(() => {
    const L = require('leaflet')
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
    })
  }, [])

  return null
}

const MapViewUpdater = ({ position }) => {
  const map = useMap()

  useEffect(() => {
    if (!position) return
    map.setView(position, 16, { animate: true })
  }, [map, position])

  return null
}

const ClickToPick = ({ onLocationSelected }) => {
  useMapEvents({
    click(event) {
      onLocationSelected(event.latlng)
    }
  })

  return null
}

const DraggableMarker = ({ position, onDragEnd }) => {
  if (!position) return null

  return (
    <Marker
      draggable
      position={position}
      eventHandlers={{
        dragend: (event) => {
          const marker = event.target
          const latlng = marker.getLatLng()
          onDragEnd(latlng)
        }
      }}
    />
  )
}

const normalizeGeocodeAddress = (geocoding = {}, lat, lng) => {
  const pincode = String(geocoding.postcode || '').replace(/\D/g, '').slice(0, 6)
  const areaParts = [
    geocoding.housenumber,
    geocoding.street,
    geocoding.locality,
    geocoding.district,
    geocoding.county
  ].filter(Boolean)

  const city = geocoding.city || geocoding.district || geocoding.county || geocoding.locality || geocoding.state || 'Unknown city'
  const state = geocoding.state || ''
  const fallbackLabel = geocoding.label || 'Selected location'

  return {
    area: areaParts.join(', ').trim() || fallbackLabel.split(',')[0].trim() || fallbackLabel,
    city,
    state,
    pincode,
    lat,
    lng
  }
}

const AddressMap = ({ onAddressFetch }) => {
  const [markerPos, setMarkerPos] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [isClient, setIsClient] = useState(false)
  const autoLocateAttemptedRef = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const applyAddress = useCallback((payload) => {
    setMarkerPos([payload.lat, payload.lng])
    onAddressFetch(payload)
  }, [onAddressFetch])

  const fetchAddressDetails = useCallback(async (lat, lng) => {
    setLoading(true)
    setSearchError('')

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=geocodejson&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)

      if (!response.ok) throw new Error('Geocoding service error')

      const data = await response.json()
      const geocoding = data?.features?.[0]?.properties?.geocoding
      if (!geocoding) throw new Error('No address data returned')

      applyAddress(normalizeGeocodeAddress(geocoding, lat, lng))
      setSearchQuery(geocoding.name || geocoding.label?.split(',')[0] || '')
      setSearchResults([])
    } catch (error) {
      console.error('Error fetching address:', error)
      applyAddress({
        area: `Selected location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        city: 'Unknown city',
        state: '',
        pincode: '',
        lat,
        lng
      })
    } finally {
      setLoading(false)
    }
  }, [applyAddress])

  const searchLocation = useCallback(async (query) => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setSearchResults([])
      setSearchError('')
      return
    }

    setSearching(true)
    setSearchError('')

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=geocodejson&addressdetails=1&limit=5&countrycodes=in&q=${encodeURIComponent(trimmed)}`
      )

      if (!response.ok) throw new Error('Search service error')

      const data = await response.json()
      const results = Array.isArray(data?.features) ? data.features : []
      setSearchResults(results)

      if (results.length === 0) {
        setSearchError('No matching places found.')
      }
    } catch (error) {
      console.error('Error searching address:', error)
      setSearchResults([])
      setSearchError('Could not search locations right now.')
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchLocation(searchQuery)
    }, 350)

    return () => clearTimeout(timer)
  }, [searchLocation, searchQuery])

  const handleLocationSelected = (latlng) => {
    setMarkerPos([latlng.lat, latlng.lng])
    void fetchAddressDetails(latlng.lat, latlng.lng)
  }

  const handleSearchSelect = (result) => {
    const coordinates = Array.isArray(result?.geometry?.coordinates) ? result.geometry.coordinates : []
    const lng = Number(coordinates[0])
    const lat = Number(coordinates[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const geocoding = result?.properties?.geocoding || {}
    setSearchQuery(geocoding.name || geocoding.label?.split(',')[0] || '')
    setSearchResults([])
    setMarkerPos([lat, lng])
    void fetchAddressDetails(lat, lng)
  }

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setSearchError('Your browser does not support location access.')
      return
    }

    setLocating(true)
    setSearchError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        void fetchAddressDetails(lat, lng)
        setLocating(false)
      },
      () => {
        setLocating(false)
        setSearchError('Could not access your current location. Please allow location access.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    )
  }, [fetchAddressDetails])

  useEffect(() => {
    if (autoLocateAttemptedRef.current) return
    autoLocateAttemptedRef.current = true
    void requestCurrentLocation()
  }, [requestCurrentLocation])

  if (!isClient) {
    return <div className="h-[520px] w-full animate-pulse rounded-[1.5rem] bg-gray-100" />
  }

  return (
    <div className="flex min-h-[520px] flex-col overflow-hidden rounded-[1.5rem] border border-[var(--line-soft)] bg-white">
      <MapIconFix />

      <div className="border-b border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search area, landmark, or street"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-28 text-sm outline-none transition focus:border-[var(--accent)]"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">
                  Searching...
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={requestCurrentLocation}
              className="rounded-xl border border-[var(--line-soft)] px-4 py-3 text-sm font-medium text-[var(--ink-900)] transition hover:bg-gray-50"
              disabled={locating}
            >
              {locating ? 'Locating...' : 'Use current location'}
            </button>
          </div>

          {(searchError || searchResults.length > 0) && (
            <div className="relative">
              {searchError && (
                <p className="mb-2 text-xs text-amber-700">{searchError}</p>
              )}

              {searchResults.length > 0 && (
                <div className="absolute z-20 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {searchResults.map((result) => {
                    const geocoding = result?.properties?.geocoding || {}
                    const title = geocoding.name || geocoding.label?.split(',')[0] || 'Selected place'
                    const subtitle = geocoding.label?.split(',').slice(1).join(', ').trim() || ''

                    return (
                      <button
                        key={`${result?.properties?.geocoding?.label || result?.geometry?.coordinates?.join('-') || 'place'}`}
                        type="button"
                        onClick={() => handleSearchSelect(result)}
                        className="block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{title}</p>
                        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative h-[420px] w-full sm:h-[460px] md:h-[500px]">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={5}
          scrollWheelZoom
          className="h-full w-full"
          style={{ height: '100%', width: '100%', zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewUpdater position={markerPos} />
          <ClickToPick onLocationSelected={handleLocationSelected} />
          <DraggableMarker position={markerPos} onDragEnd={handleLocationSelected} />
        </MapContainer>

        <div className="pointer-events-none absolute left-4 right-4 bottom-4 z-10">
          <div className="rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-center text-sm text-gray-700 shadow-sm">
            Search a place, tap the map, drag the pin, or use current location for a better address match.
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="brand-tag animate-pulse rounded-full px-4 py-2 shadow-lg">Fetching address...</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AddressMap
