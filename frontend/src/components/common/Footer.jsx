import React from 'react';
import { Phone, ShieldAlert, Heart, Code2 } from 'lucide-react';

export default function Footer({ onNavigate }) {
  return (
    <footer style={{
      backgroundColor: '#0f172a',
      color: '#cbd5e1',
      marginTop: 'auto',
      borderTop: '1px solid #1e293b',
      padding: '48px 0 24px 0',
      fontSize: '14px',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '36px',
          marginBottom: '36px'
        }}>
          {/* Column 1: Project Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>
              <ShieldAlert size={22} color="#e11d48" /> RoadWatch Bulacan
            </div>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, fontSize: '13px', marginBottom: '14px' }}>
              A web and mobile-based road accident reporting and response tracking platform designed to facilitate rapid citizen reporting, verified records, and traffic officer dispatch.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#1e293b', borderRadius: '6px', fontSize: '12px', color: '#38bdf8' }}>
              <Code2 size={14} /> IT 305 &bull; Bulacan State University
            </div>
          </div>

          {/* Column 2: Emergency Hotlines */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '15px', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Emergency Hotlines
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="#e11d48" /> <strong>Emergency Dispatch:</strong> 911
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="#e11d48" /> <strong>Bulacan Rescue / PDRRMO:</strong> (044) 791-0566
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="#e11d48" /> <strong>PNP Malolos City Police:</strong> (044) 791-0168
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="#e11d48" /> <strong>NLEX Traffic Operations:</strong> (02) 8580-8910
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Navigation */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '15px', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System Links
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <span style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => onNavigate('home')}>Home Overview</span>
              <span style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => onNavigate('report-incident')}>Submit Accident Report</span>
              <span style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => onNavigate('map')}>Interactive Incident Map</span>
              <span style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => onNavigate('login')}>Portal Access (Admin & Officers)</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid #1e293b',
          paddingTop: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <div>
            &copy; 2026 RoadWatch. Bulacan State University IT 305 Project. All rights reserved.
          </div>
          <div>
            Backend: Laravel 12 API &bull; Database: Local XAMPP MySQL &bull; Maps: OpenStreetMap + Leaflet
          </div>
        </div>
      </div>
    </footer>
  );
}
