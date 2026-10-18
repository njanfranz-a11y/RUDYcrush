import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Filter, Layers, MapPin } from 'lucide-react';

const createCustomIcon = (status) => {
  let color = 'blue';
  if (status === 'closed') color = 'grey';
  else if (status === 'verified') color = 'green';
  else if (status === 'in_progress') color = 'blue';
  else if (status === 'submitted' || status === 'under_review') color = 'orange';
  else color = 'red';

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

export default function AccidentMapViewer({ reports = [], height = '500px', onSelectReport }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [14.8527, 120.8160], // Malolos, Bulacan center
        zoom: 12,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    // Refresh markers based on reports and filters
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();

      const filtered = reports.filter((r) => {
        if (!r.latitude || !r.longitude) return false;
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (severityFilter !== 'ALL' && r.injury_severity !== severityFilter) return false;
        return true;
      });

      const bounds = [];

      filtered.forEach((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        bounds.push([lat, lng]);

        const marker = L.marker([lat, lng], {
          icon: createCustomIcon(r.status),
        });

        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.4; min-width: 200px;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 14px;">${r.report_number}</div>
            <div style="color: #e11d48; font-weight: 600; font-size: 12px; margin-bottom: 6px;">${r.accident_type}</div>
            <div style="color: #475569; margin-bottom: 4px;"><strong>Location:</strong> ${r.location_address}</div>
            <div style="color: #475569; margin-bottom: 4px;"><strong>Date:</strong> ${r.accident_date} ${r.accident_time || ''}</div>
            <div style="color: #475569; margin-bottom: 8px;"><strong>Severity:</strong> <span style="text-transform: capitalize;">${r.injury_severity}</span></div>
            <div style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; text-transform: uppercase;">
              ${r.status.replace('_', ' ')}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(markersLayerRef.current);
      });

      if (bounds.length > 0 && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }

    return () => {
      // Do not destroy on filter changes, handled by clearLayers
    };
  }, [reports, statusFilter, severityFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Map Filter Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        padding: '12px 16px',
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
          <Filter size={16} /> Filters:
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="ALL">All Severities</option>
          <option value="none">No Injuries</option>
          <option value="minor">Minor Injury</option>
          <option value="severe">Severe Injury</option>
          <option value="fatal">Fatal Incident</option>
          <option value="unknown">Unknown</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing <strong>{reports.filter(r => r.latitude && r.longitude).length}</strong> mapped incidents
        </div>
      </div>

      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        style={{
          height,
          width: '100%',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}
      />
    </div>
  );
}
