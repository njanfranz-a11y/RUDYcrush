import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, AlertCircle } from 'lucide-react';

// Fix Leaflet's default marker icon path issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Red Accent Pin for Accidents
const accidentPin = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function LeafletMapPicker({
  latitude,
  longitude,
  onLocationSelect,
  height = '360px',
  interactive = true,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [geoStatus, setGeoStatus] = useState('');

  // Default coordinate: Malolos City, Bulacan (Capitol / BSU area)
  const defaultLat = 14.8527;
  const defaultLng = 120.8160;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = latitude ? parseFloat(latitude) : defaultLat;
      const initialLng = longitude ? parseFloat(longitude) : defaultLng;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: latitude ? 15 : 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (latitude && longitude) {
        markerRef.current = L.marker([initialLat, initialLng], {
          icon: accidentPin,
          draggable: interactive,
        }).addTo(map);

        if (interactive) {
          markerRef.current.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            onLocationSelect(pos.lat, pos.lng);
          });
        }
      }

      if (interactive) {
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng], {
              icon: accidentPin,
              draggable: true,
            }).addTo(map);

            markerRef.current.on('dragend', (event) => {
              const pos = event.target.getLatLng();
              onLocationSelect(pos.lat, pos.lng);
            });
          }
          onLocationSelect(lat, lng);
        });
      }

      mapInstanceRef.current = map;
    } else {
      // Update marker position if props change externally
      if (latitude && longitude && mapInstanceRef.current) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], {
            icon: accidentPin,
            draggable: interactive,
          }).addTo(mapInstanceRef.current);
        }
      }
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Browser does not support automatic geolocation.');
      return;
    }
    setGeoStatus('Locating current GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGeoStatus('GPS location acquired!');
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng], {
              icon: accidentPin,
              draggable: interactive,
            }).addTo(mapInstanceRef.current);
          }
        }
        onLocationSelect(lat, lng);
      },
      (err) => {
        setGeoStatus(`Location access denied or unavailable (${err.message}). You can still click anywhere on the map.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {interactive && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleCurrentLocation}
            style={{ boxShadow: 'var(--shadow-md)', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
          >
            <Navigation size={14} color="#e11d48" /> Use Current GPS
          </button>
        </div>
      )}

      <div ref={mapContainerRef} style={{ height, width: '100%', zIndex: 1 }} />

      {interactive && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid var(--border-color)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            {latitude && longitude
              ? `Selected: Lat ${Number(latitude).toFixed(6)}, Lng ${Number(longitude).toFixed(6)}`
              : 'Click on the map or drag the red pin to select incident spot.'}
          </span>
          {geoStatus && (
            <span style={{ color: geoStatus.includes('denied') ? 'var(--danger)' : 'var(--info)', fontWeight: 500 }}>
              {geoStatus}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
