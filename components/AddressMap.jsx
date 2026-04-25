'use client'
import React, { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'

// Helper to handle icon issue in Leaflet + Next.js
const MapIconFix = () => {
  useEffect(() => {
    const L = require('leaflet');
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);
  return null;
}

const LocationPicker = ({ onLocationSelected }) => {
  useMapEvents({
    click(e) {
      onLocationSelected(e.latlng)
    },
  })
  return null
}

const AddressMap = ({ onAddressFetch }) => {
  const [markerPos, setMarkerPos] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const fetchAddressDetails = async (lat, lng) => {
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)
      
      if (!response.ok) throw new Error('Geocoding service error')
      const data = await response.json()
      
      if (data && data.address) {
        const addr = data.address
        // Improved accuracy: prioritize more specific address components
        const area = addr.road || addr.neighbourhood || addr.suburb || addr.village || addr.county || addr.residential || addr.hamlet || addr.farmland || ''
        
        // For rural areas, try multiple fallbacks to find a city name
        let city = addr.city || addr.town || addr.municipal || addr.municipality || addr.village_green || addr.village || ''
        
        // If city not found, try district/county/administrative
        if (!city) {
          city = addr.district || addr.county || addr.administrative || addr.region || ''
        }
        
        // Last resort: parse display_name for a city-like location
        if (!city && data.display_name) {
          const parts = data.display_name.split(',').map(p => p.trim())
          // Look for a city-level component
          if (parts.length > 1) {
            // Usually the 2nd or 3rd from the end are city/district level
            city = parts[parts.length - 3] || parts[parts.length - 2] || ''
          }
        }
        
        const state = addr.state || addr.province || addr.region || ''
        const pincode = addr.postcode || ''
        
        const fullName = area || data.display_name?.split(',')[0] || 'Location'
        
        onAddressFetch({
          pincode: pincode.split(';')[0].trim() || '',
          city: city.trim() || 'Rural Area',
          state: state.trim() || '',
          area: fullName.trim(),
          lat: lat,
          lng: lng
        })
      } else {
        throw new Error('No address data returned')
      }
    } catch (error) {
      console.error('Error fetching address:', error)
      // Fallback: provide coordinates-based feedback
      onAddressFetch({
        area: `Selected location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        city: 'Rural/Unidentified Area',
        state: '',
        pincode: '',
        lat: lat,
        lng: lng
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLocationSelected = (latlng) => {
    setMarkerPos([latlng.lat, latlng.lng])
    fetchAddressDetails(latlng.lat, latlng.lng)
  }

  if (!isClient) return <div className="w-full h-[400px] bg-gray-100 animate-pulse rounded-[1.5rem]" />

  return (
    <div className="w-full h-[400px] rounded-[1.5rem] overflow-hidden border border-[var(--line-soft)] relative">
      <MapIconFix />
      <MapContainer 
        center={[20.5937, 78.9629]} 
        zoom={5} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationPicker onLocationSelected={handleLocationSelected} />
        {markerPos && <Marker position={markerPos} />}
      </MapContainer>
      <div className="absolute left-4 right-4 bottom-4 z-10 pointer-events-none">
        <div className="rounded-full bg-white/90 px-4 py-2 text-sm text-gray-700 border border-gray-200 shadow-sm text-center">
          Click anywhere on the map to drop a pin and autofill address fields.
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-[1000] flex items-center justify-center">
          <div className="brand-tag px-4 py-2 rounded-full animate-pulse shadow-lg">Fetching Details...</div>
        </div>
      )}
    </div>
  )
}

export default AddressMap
