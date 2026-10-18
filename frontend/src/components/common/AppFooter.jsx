import React from 'react';

export default function AppFooter({ onNavigate }) {
  return (
    <footer className="app-footer-bar">
      <div>
        <strong>RoadWatch Bulacan</strong> &bull; IT 305 &bull; Bulacan State University
      </div>
      <div>
        Laravel 12 API &bull; Local XAMPP MySQL &bull; OpenStreetMap + Leaflet
      </div>
    </footer>
  );
}
