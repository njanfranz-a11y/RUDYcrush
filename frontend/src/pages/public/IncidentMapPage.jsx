import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import AccidentMapViewer from '../../components/map/AccidentMapViewer';
import { MapPin, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function IncidentMapPage({ onSelectReport, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMapReports = () => {
    setLoading(true);
    api.getPublicMap()
      .then((res) => {
        if (res.data?.success) {
          setReports(res.data.data || []);
        }
      })
      .catch((err) => console.log('Map points load:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMapReports();
  }, []);

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('home');
    } else {
      window.history.back();
    }
  };

  return (
    <div className="dashboard-container">
      {/* Return to Landing Page navigation pill */}
      <div style={{ marginBottom: '14px' }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: '#ffffff',
            border: '1px solid var(--border-color, #dde3ee)',
            borderRadius: '9999px',
            color: 'var(--ink, #0f1d38)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
          title="Return to Landing Page"
        >
          <ArrowLeft size={15} /> Back to Home
        </button>
      </div>

      <div className="dashboard-title-row">
        <div>
          <div className="command-eyebrow" style={{ color: '#0284c7' }}>
            <MapPin size={14} /> GIS Incident Visualization &bull; Bulacan Corridors
          </div>
          <h1 className="dashboard-heading">Bulacan Road Incident Map</h1>
          <p className="dashboard-subheading">
            Live geospatial distribution of verified accidents and cleared traffic incidents
          </p>
        </div>

        <div className="dashboard-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #dde3ee)',
              background: '#ffffff',
              color: 'var(--ink, #0f1d38)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            className="btn-dash-outline"
            onClick={loadMapReports}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Map Pins
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading geospatial incident layers...
        </div>
      ) : (
        <AccidentMapViewer
          reports={reports}
          height="620px"
          onSelectReport={onSelectReport}
        />
      )}
    </div>
  );
}
