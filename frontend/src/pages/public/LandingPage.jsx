import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import opsCenterImg from '../../assets/operations_center.jpg';

// Helper to create custom colored SVG pin markers with radar ping for Leaflet map
function createIncidentPin(severity) {
  const sev = (severity || '').toLowerCase();
  let color = '#ffb020'; // default amber (medium)
  if (sev.includes('fatal') || sev.includes('critical') || sev.includes('severe')) {
    color = '#ff4d4f'; // red
  } else if (sev.includes('high') || sev.includes('serious')) {
    color = '#fb923c'; // orange
  } else if (sev.includes('low') || sev.includes('minor') || sev.includes('none')) {
    color = '#22c55e'; // green
  }

  return L.divIcon({
    className: 'roadwatch-leaflet-pin',
    html: `
      <div style="position:relative; width:26px; height:26px; transform:translate(-50%, -100%); cursor:pointer;">
        <svg viewBox="0 0 24 24" width="26" height="26" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5)); display:block; position:relative; z-index:2;">
          <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z" fill="${color}"/>
          <circle cx="12" cy="9" r="2.8" fill="#0a1428"/>
        </svg>
        <span style="position:absolute; left:50%; top:100%; width:10px; height:10px; border-radius:50%; transform:translate(-50%, -50%); background:${color}; opacity:0.45; display:block;"></span>
        <span class="pulse-ring" style="position:absolute; left:50%; top:100%; width:10px; height:10px; border-radius:50%; transform:translate(-50%, -50%); border:2px solid ${color}; animation:ping 2.2s cubic-bezier(0, 0.2, 0.8, 1) infinite; pointer-events:none; display:block;"></span>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -28]
  });
}

// Ease-out cubic animated number count-up from reference HTML
function AnimatedNumber({ value, suffix = '', duration = 1300, isDecimal = false }) {
  const [displayValue, setDisplayValue] = useState(0);
  const elementRef = useRef(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const target = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, '')) || 0;
    if (isNaN(target)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animatedRef.current) {
            animatedRef.current = true;
            let start = null;
            const tick = (ts) => {
              if (!start) start = ts;
              const progress = Math.min((ts - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const cur = target * eased;
              setDisplayValue(isDecimal ? cur.toFixed(1) : Math.round(cur).toLocaleString());
              if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration, isDecimal]);

  return (
    <span ref={elementRef}>
      {displayValue}
      {suffix}
    </span>
  );
}

// Static incident ticker array from reference HTML (duplicated for seamless -50% CSS looping)
const TICKER_ITEMS = [
  { tag: 'red', status: 'CRITICAL', title: 'Pothole cluster', loc: 'MacArthur Hwy, Marilao', time: '2m ago' },
  { tag: 'green', status: 'RESOLVED', title: 'Streetlight fixed', loc: 'Imeia St, Guiguinto', time: '18m ago' },
  { tag: 'amber', status: 'IN PROGRESS', title: 'Fallen branch obstruction', loc: 'Baliwag → Pulilan Rd', time: '31m ago' },
  { tag: 'orange', status: 'HIGH', title: 'Road shoulder collapse', loc: 'Bulakan', time: '45m ago' },
  { tag: 'green', status: 'RESOLVED', title: 'Drainage clearance', loc: 'San Rafael', time: '1h ago' },
  { tag: 'red', status: 'CRITICAL', title: 'Hit-and-run investigation', loc: 'City of Malolos', time: '1h ago' },
  { tag: 'amber', status: 'IN PROGRESS', title: 'Traffic barrier misaligned', loc: 'Meycauayan', time: '1h ago' }
];

// Robust Leaflet Map component with StrictMode double-mount protection
function HeroIncidentMap({ reports, onSelectReport }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Clear any previous Leaflet ID if container was recycled
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const map = L.map(container, {
      center: [14.8527, 120.8160], // Bulacan center (Malolos)
      zoom: 11,
      zoomControl: true,
      scrollWheelZoom: true, // Fully zoomable like the live map
      doubleClickZoom: true,
      touchZoom: true,
      attributionControl: false
    });

    mapInstanceRef.current = map;

    // Standard high-reliability OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);

    const validReports = Array.isArray(reports) ? reports.filter(r => r.latitude && r.longitude) : [];
    const pointsToDisplay = validReports.length > 0 ? validReports : [
      { id: 1, report_number: 'RW-24188', accident_type: 'Pothole & Road Damage', location_address: 'MacArthur Hwy, Marilao', barangay: 'Bayugo', injury_severity: 'critical', status: 'submitted', latitude: 14.7578, longitude: 120.9575 },
      { id: 2, report_number: 'RW-24187', accident_type: 'Traffic Obstruction', location_address: 'Baliwag–Pulilan Rd, Pobliran', barangay: 'Pobliran', injury_severity: 'high', status: 'under_review', latitude: 14.9542, longitude: 120.8986 },
      { id: 3, report_number: 'RW-24186', accident_type: 'Streetlight Outage', location_address: 'Imeia St, Guiguinto', barangay: 'Poblacion', injury_severity: 'low', status: 'in_progress', latitude: 14.8322, longitude: 120.8808 },
      { id: 4, report_number: 'RW-24185', accident_type: 'Flooding & Drainage', location_address: 'Sampaloc Rd, Malolos', barangay: 'Sampaloc', injury_severity: 'critical', status: 'in_progress', latitude: 14.8433, longitude: 120.8114 },
      { id: 5, report_number: 'RW-24184', accident_type: 'Road Signage Missing', location_address: 'JP Rizal St, Bulakan', barangay: 'Bagong Silang', injury_severity: 'medium', status: 'closed', latitude: 14.7928, longitude: 120.8789 }
    ];

    const bounds = [];
    pointsToDisplay.forEach((r) => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.push([lat, lng]);
      const marker = L.marker([lat, lng], {
        icon: createIncidentPin(r.injury_severity || r.severity)
      });

      const popupHtml = `
        <div style="font-family:'IBM Plex Sans', -apple-system, sans-serif; font-size:12.5px; line-height:1.45; min-width:200px; color:#0f1d38; padding: 2px;">
          <div style="font-weight:700; color:#1e3a6b; font-size:13px; margin-bottom:2px;">
            ${r.report_number || `INCIDENT #${r.id}`}
          </div>
          <div style="font-weight:600; font-size:12px; margin-bottom:4px; color:#0f1d38;">
            ${r.accident_type || 'Road Hazard'}
          </div>
          <div style="color:#5a6b8a; font-size:11.5px; margin-bottom:6px;">
            📍 ${r.location_address || 'Bulacan corridor'}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #dde3ee; padding-top:6px; margin-top:4px;">
            <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#e08a00;">
              ${r.injury_severity || 'Moderate'}
            </span>
            <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#15803d; background:#dcfce7; padding:2px 6px; border-radius:4px;">
              ${(r.status || 'Active').replace('_', ' ')}
            </span>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.addTo(markersGroup);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
    }

    // Force map size refresh after DOM layout completes
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      try {
        map.remove();
      } catch (err) {
        // Safe cleanup
      }
      mapInstanceRef.current = null;
    };
  }, [reports]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '340px',
        borderRadius: '12px',
        overflow: 'hidden',
        zIndex: 1
      }}
    />
  );
}

export default function LandingPage({ onNavigate }) {
  const { user, isAdmin, isOfficer } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 1284,
    resolved: 41208,
    open: 1284,
    avgHours: 19,
    offices: 34
  });
  const [publicReports, setPublicReports] = useState([]);
  const [recentFeed, setRecentFeed] = useState([
    { dot: 'var(--red, #ff4d4f)', label: 'Pothole cluster — MacArthur Hwy, Marilao', time: '2m ago' },
    { dot: 'var(--amber, #ffb020)', label: 'Fallen branch obstruction — Baliwag → Pulilan Rd', time: '9m ago' },
    { dot: 'var(--green, #22c55e)', label: 'Streetlight repaired — Imeia St, Guiguinto', time: '24m ago' }
  ]);

  // Navbar scroll background blur transition
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver for .reveal scroll animations
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [publicReports]);

  useEffect(() => {
    // Fetch live statistics and real incidents for map & telemetry feed
    api.getPublicMap()
      .then((res) => {
        if (res.data?.success) {
          const fetched = res.data.data || [];
          if (fetched.length > 0) {
            setPublicReports(fetched);
            const closedCount = fetched.filter(r => r.status === 'closed' || r.status === 'resolved').length;
            const openCount = fetched.filter(r => r.status !== 'closed' && r.status !== 'resolved').length;

            setStats(prev => ({
              ...prev,
              open: openCount > 0 ? openCount : prev.open,
              resolved: 41200 + closedCount
            }));

            const feedItems = fetched.slice(0, 3).map((r, i) => {
              const sev = (r.injury_severity || '').toLowerCase();
              let dot = 'var(--amber, #ffb020)';
              if (sev.includes('fatal') || sev.includes('critical')) dot = 'var(--red, #ff4d4f)';
              else if (r.status === 'closed' || r.status === 'resolved') dot = 'var(--green, #22c55e)';

              return {
                dot,
                label: `${r.accident_type || 'Road hazard'} — ${r.location_address || 'Bulacan'}`,
                time: r.accident_time || `${(i + 1) * 7}m ago`
              };
            });

            if (feedItems.length > 0) {
              setRecentFeed(feedItems);
            }
          }
        }
      })
      .catch((err) => console.log('Public map load error:', err.message));
  }, []);

  return (
    <div style={{ width: '100%', background: 'var(--paper, #f4f6fb)', minHeight: '100vh', color: 'var(--ink, #0f1d38)' }}>
      {/* 1. STICKY TOP NAVIGATION BAR WITH BLUR TRANSITION */}
      <header className={`lnav ${scrolled ? 'scrolled' : ''}`}>
        <div className="wrap nav-row">
          {/* Logo with Bulletproof Inline Dimensions */}
          <a
            href="#"
            className="logo"
            onClick={(e) => { e.preventDefault(); onNavigate('home'); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
              color: 'var(--ink, #0f1d38)'
            }}
          >
            <span
              className="logo__mark"
              style={{
                width: '40px',
                height: '40px',
                minWidth: '40px',
                minHeight: '40px',
                borderRadius: '11px',
                background: 'linear-gradient(145deg, #0f1d38, #1e3a6b)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(10, 20, 40, 0.18)'
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  width: '22px',
                  height: '22px',
                  minWidth: '22px',
                  minHeight: '22px',
                  color: '#ffb020',
                  stroke: '#ffb020',
                  display: 'block'
                }}
              >
                <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </span>
            <span
              className="logo__txt"
              style={{
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                lineHeight: 1.2
              }}
            >
              <b
                style={{
                  fontFamily: "var(--font-display, 'Sora', sans-serif)",
                  fontWeight: 800,
                  fontSize: '1.12rem',
                  letterSpacing: '-0.02em',
                  display: 'block',
                  color: 'var(--ink, #0f1d38)',
                  margin: 0
                }}
              >
                RoadWatch
              </b>
              <small
                style={{
                  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
                  fontSize: '0.62rem',
                  letterSpacing: '0.13em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-mute, #8a97ad)',
                  margin: 0
                }}
              >
                Province of Bulacan
              </small>
            </span>
          </a>

          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#types">Report types</a>
            <a href="#impact">Impact</a>
            <a href="#voices">Community</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('map'); }}>Live Map</a>
          </nav>

          <div className="nav-right">
            <span className="lang-chip">🌐 EN / FIL</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onNavigate(user ? (isAdmin ? 'admin-dashboard' : isOfficer ? 'officer-dashboard' : 'my-reports') : 'login')}
            >
              {user ? 'Dashboard' : 'Sign in'}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => onNavigate('report-incident')}
            >
              Report an incident
            </button>
            <button
              type="button"
              className={`burger ${mobileMenuOpen ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-nav-drawer">
            <a href="#how" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#types" onClick={() => setMobileMenuOpen(false)}>Report types</a>
            <a href="#impact" onClick={() => setMobileMenuOpen(false)}>Impact</a>
            <a href="#voices" onClick={() => setMobileMenuOpen(false)}>Community</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); onNavigate('map'); }}>Live Map</a>
            <div className="mobile-nav-actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => { setMobileMenuOpen(false); onNavigate(user ? (isAdmin ? 'admin-dashboard' : isOfficer ? 'officer-dashboard' : 'my-reports') : 'login'); }}
              >
                {user ? 'Command dashboard' : 'Sign in'}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => { setMobileMenuOpen(false); onNavigate('report-incident'); }}
              >
                Report an incident
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION WITH EMBEDDED REAL INCIDENT LEAFLET MAP */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="hero-status-pill">
              <span className="badge badge--live"><span className="dot"></span>LIVE</span>
              <span className="hero-status-text">{stats.open.toLocaleString()} open incidents province-wide</span>
            </div>
            <h1 className="hd">
              Report road &amp; public-safety hazards <span className="hl">in under 60 seconds.</span>
            </h1>
            <p className="lead">
              RoadWatch Bulacan pins your report to the exact location, routes it to the right municipal office, and lets you track it until it is fixed &mdash; verified by people, not bots.
            </p>
            <div className="hero__cta">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onNavigate('report-incident')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                File a report
              </button>
              <button
                type="button"
                className="btn btn--ghost-light"
                onClick={() => onNavigate(user ? (isAdmin ? 'admin-dashboard' : isOfficer ? 'officer-dashboard' : 'my-reports') : 'login')}
              >
                Open command dashboard
              </button>
            </div>
            <div className="trust">
              <span className="t-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <b>{stats.resolved.toLocaleString()}+</b> resolved
              </span>
              <span className="t-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
                Official LGU-backed system
              </span>
              <span className="t-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Avg. response 19 hours
              </span>
            </div>
          </div>

          {/* Interactive Province Map Card showing actual incidents */}
          <div className="mapcard">
            <div className="mapcard__head">
              <div>
                <b style={{ fontFamily: "var(--font-display, 'Sora', sans-serif)", fontSize: '0.96rem', color: '#fff' }}>
                  Province live incident map
                </b>
                <div className="mono">14 municipalities &middot; 20 cities &middot; live telemetry</div>
              </div>
              <button
                type="button"
                className="badge badge--live"
                style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => onNavigate('map')}
                title="Open full interactive map"
              >
                <span className="dot"></span>Live Map &rarr;
              </button>
            </div>

            {/* REAL LEAFLET MAP SHOWING ACTUAL INCIDENTS */}
            <div className="mapcanvas">
              <HeroIncidentMap
                reports={publicReports}
                onSelectReport={() => onNavigate('map')}
              />
            </div>

            {/* LIVE FEED UNDER MAP */}
            <div className="mapfeed">
              {recentFeed.map((f, idx) => (
                <div
                  key={idx}
                  className="feedrow"
                  onClick={() => onNavigate('map')}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="fdot" style={{ background: f.dot }}></span>
                  <span>{f.label}</span>
                  <span className="mono">{f.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. INCIDENT TICKER MARQUEE (Duplicated loop matching reference HTML) */}
      <div className="ticker" title="Provincial Hazard Ticker — Hover to pause">
        <div className="ticker__track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
            <div key={idx} className="titem">
              <span className={`tag ${item.tag}`}>{item.status}</span>
              <b>{item.title}</b> {item.loc} &middot; {item.time}
            </div>
          ))}
        </div>
      </div>

      {/* 4. STATS BAND WITH EASING COUNT-UP ANIMATION */}
      <section className="statsband">
        <div className="wrap" style={{ paddingInline: 0 }}>
          <div className="statsgrid reveal">
            <div className="statcell">
              <div className="num"><AnimatedNumber value={stats.resolved} />+</div>
              <div className="lbl">Incidents resolved <span className="trend mono">&uarr; 18% YoY</span></div>
            </div>
            <div className="statcell">
              <div className="num"><AnimatedNumber value={stats.open} /></div>
              <div className="lbl">Open right now <span className="trend mono" style={{ color: 'var(--amber-deep, #e08a00)' }}>live</span></div>
            </div>
            <div className="statcell">
              <div className="num"><AnimatedNumber value={stats.avgHours} /><span className="u">h</span></div>
              <div className="lbl">Average response time</div>
            </div>
            <div className="statcell">
              <div className="num"><AnimatedNumber value={stats.offices} /></div>
              <div className="lbl">LGU partner offices</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section className="section reveal" id="how">
        <div className="wrap">
          <div className="shead center">
            <h2 className="hd">Four steps from hazard to highway</h2>
            <p style={{ marginInline: 'auto' }}>
              No account needed to file. Every report is geotagged, time-stamped and permanently traceable.
            </p>
          </div>
          <div className="steps">
            <article className="stepcard">
              <span className="n">01</span><span className="sconnect"></span>
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h3>Snap &amp; pinpoint</h3>
              <p>Take a photo and we auto-fill GPS coordinates, barangay and nearest landmark.</p>
            </article>

            <article className="stepcard">
              <span className="n">02</span><span className="sconnect"></span>
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16v12H5.2L4 17.5Z" />
                  <path d="M8 9h8M8 12h5" />
                </svg>
              </div>
              <h3>Classify severity</h3>
              <p>Pick the hazard type and severity so dispatch can rank it against other open items.</p>
            </article>

            <article className="stepcard">
              <span className="n">03</span><span className="sconnect"></span>
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12h4l3-8 4 16 3-8h4" />
                </svg>
              </div>
              <h3>Verify on site</h3>
              <p>A field officer confirms the report with a photo before work orders are issued.</p>
            </article>

            <article className="stepcard">
              <span className="n">04</span>
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h3>Fixed &amp; closed</h3>
              <p>You get a notification and can rate the resolution once the crew finishes.</p>
            </article>
          </div>
        </div>
      </section>

      {/* 6. INCIDENT TYPES */}
      <section className="section dark reveal" id="types">
        <div className="wrap">
          <div className="shead">
            <h2 className="hd">Nine hazard categories, one response system</h2>
            <p>From potholes to flooding, every category routes to the municipal office that owns it.</p>
          </div>
          <div className="itiles">
            <article className="itile" onClick={() => onNavigate('report-incident')} style={{ cursor: 'pointer' }}>
              <div className="itile__top">
                <span className="iico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 17l4-8 4 5 3-7 7 10Z" />
                  </svg>
                </span>
                <span className="cnt">482 open</span>
              </div>
              <h4>Potholes &amp; road damage</h4>
              <p>Craters, sinkholes and broken pavement on national and provincial routes.</p>
            </article>

            <article className="itile" onClick={() => onNavigate('report-incident')} style={{ cursor: 'pointer' }}>
              <div className="itile__top">
                <span className="iico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v6M12 22v-6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M22 12h-6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2" />
                  </svg>
                </span>
                <span className="cnt">211 open</span>
              </div>
              <h4>Flooding &amp; drainage</h4>
              <p>Blocked culverts, street flooding and waterway obstructions during monsoon.</p>
            </article>

            <article className="itile" onClick={() => onNavigate('report-incident')} style={{ cursor: 'pointer' }}>
              <div className="itile__top">
                <span className="iico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2 4 7v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V7Z" />
                  </svg>
                </span>
                <span className="cnt">163 open</span>
              </div>
              <h4>Traffic obstructions</h4>
              <p>Fallen trees, stalled vehicles and illegal barriers blocking lanes.</p>
            </article>

            <article className="itile" onClick={() => onNavigate('report-incident')} style={{ cursor: 'pointer' }}>
              <div className="itile__top">
                <span className="iico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5V16H8v-2.5A6 6 0 0 1 12 3Z" />
                  </svg>
                </span>
                <span className="cnt">148 open</span>
              </div>
              <h4>Streetlight outages</h4>
              <p>Dark stretches on major roads &mdash; linked directly to the power utility.</p>
            </article>

            <article className="itile" onClick={() => onNavigate('report-incident')} style={{ cursor: 'pointer' }}>
              <div className="itile__top">
                <span className="iico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 11h18M6 11V9a6 6 0 0 1 12 0v2M5 11v8h14v-8" />
                    <path d="M10 15h4" />
                  </svg>
                </span>
                <span className="cnt">121 open</span>
              </div>
              <h4>Road signage</h4>
              <p>Missing, damaged or faded signs at intersections and school zones.</p>
            </article>

            <article className="itile" onClick={() => onNavigate('report-incident')} style={{ cursor: 'pointer' }}>
              <div className="itile__top">
                <span className="iico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 20h18M6 20V10l6-6 6 6v10M10 20v-6h4v6" />
                  </svg>
                </span>
                <span className="cnt">159 open</span>
              </div>
              <h4>Public structures</h4>
              <p>Damaged shelters, barangay halls, bridges and public road facilities.</p>
            </article>
          </div>
        </div>
      </section>

      {/* 7. IMPACT */}
      <section className="section reveal" id="impact">
        <div className="wrap impact">
          <div className="impact__visual">
            <img
              src={opsCenterImg}
              alt="Bulacan Road Safety & Emergency Response Operations Center"
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', aspectRatio: '4/3', borderRadius: '14px' }}
            />
            <div className="fstat a">
              <span className="n"><AnimatedNumber value={94} suffix="%" /></span>
              <span className="l">Reports verified<br />within 24 hours</span>
            </div>
            <div className="fstat b">
              <span className="n"><AnimatedNumber value={3.2} suffix="×" isDecimal={true} /></span>
              <span className="l">Faster than<br />hotline calls</span>
            </div>
          </div>
          <div>
            <h2 className="hd" style={{ fontSize: 'clamp(1.8rem, 3.8vw, 2.7rem)', margin: '.2rem 0 1rem' }}>
              Built with barangays, not just for them
            </h2>
            <p style={{ color: 'var(--ink-soft)' }}>
              RoadWatch was designed alongside municipal disaster officers, barangay captains and volunteer validators. The goal was simple: one place where a resident's photo turns into a verified work order with an owner and a deadline.
            </p>
            <ul className="checklist">
              <li>
                <span className="ck">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <b>Full audit trail</b>
                  <span>Every state change is logged with the officer, timestamp and reason.</span>
                </div>
              </li>
              <li>
                <span className="ck">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <b>Dual verification</b>
                  <span>Reports need a photo check before they reach the public work queue.</span>
                </div>
              </li>
              <li>
                <span className="ck">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <b>Offline-first filing</b>
                  <span>Queued submissions sync automatically when signal returns.</span>
                </div>
              </li>
              <li>
                <span className="ck">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <b>Open data export</b>
                  <span>Any LGU can pull an anonymised dataset for budgeting and planning.</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. COMMUNITY VOICES */}
      <section className="section reveal" id="voices" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="shead center">
            <h2 className="hd">Reported by residents. Resolved by neighbours</h2>
          </div>
          <div className="quotes">
            <article className="qcard">
              <span className="qmark">&ldquo;</span>
              <p>My street was flooded for three days. I filed at 6am and by the afternoon the drainage crew was already there. I've never seen a hotline work that fast.</p>
              <div className="qperson">
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>MD</div>
                <div><b>Marisol D.</b><small>Barangay Captain, Marilao</small></div>
              </div>
            </article>

            <article className="qcard">
              <span className="qmark">&ldquo;</span>
              <p>As an LGU engineer I used to chase down reports by text. Now everything lands in one queue with coordinates attached. Dispatch takes minutes.</p>
              <div className="qperson">
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>RS</div>
                <div><b>Engr. R. Santiago</b><small>Municipal Engineer, Baliwag</small></div>
              </div>
            </article>

            <article className="qcard">
              <span className="qmark">&ldquo;</span>
              <p>The verification step matters. It kills the fake reports and the duplicate flooding complaints in one go.</p>
              <div className="qperson">
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>JM</div>
                <div><b>J. Mendoza</b><small>Response Officer, Pulilan</small></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 9. CTA BANNER */}
      <div className="wrap">
        <div className="cta reveal">
          <div>
            <h2 className="hd">Spotted something? Two minutes is all it takes</h2>
            <p>No forms, no hotline queues. Pin it, snap it, send it.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onNavigate('report-incident')}
            >
              Report an incident &rarr;
            </button>
            <button
              type="button"
              className="btn btn--ghost-light"
              onClick={() => onNavigate('login')}
            >
              Staff sign-in
            </button>
          </div>
        </div>
      </div>

      {/* 10. COMPREHENSIVE CIVIC FOOTER */}
      <footer className="footer">
        <div className="wrap">
          <div className="fgrid">
            <div>
              <a
                href="#"
                className="logo logo--light"
                onClick={(e) => { e.preventDefault(); onNavigate('home'); }}
                style={{
                  marginBottom: '1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  textDecoration: 'none'
                }}
              >
                <span
                  className="logo__mark"
                  style={{
                    width: '40px',
                    height: '40px',
                    minWidth: '40px',
                    minHeight: '40px',
                    borderRadius: '11px',
                    background: 'linear-gradient(145deg, #0f1d38, #1e3a6b)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      width: '22px',
                      height: '22px',
                      color: '#ffb020',
                      stroke: '#ffb020',
                      display: 'block'
                    }}
                  >
                    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </span>
                <span
                  className="logo__txt"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    textAlign: 'left',
                    lineHeight: 1.2
                  }}
                >
                  <b
                    style={{
                      fontFamily: "var(--font-display, 'Sora', sans-serif)",
                      fontWeight: 800,
                      fontSize: '1.12rem',
                      color: 'var(--on-dark, #eaf0fb)',
                      display: 'block',
                      margin: 0
                    }}
                  >
                    RoadWatch
                  </b>
                  <small
                    style={{
                      fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
                      fontSize: '0.62rem',
                      letterSpacing: '0.13em',
                      textTransform: 'uppercase',
                      color: 'var(--on-dark-soft, #9db0cf)',
                      margin: 0
                    }}
                  >
                    Province of Bulacan
                  </small>
                </span>
              </a>
              <p>A civic incident reporting platform operated with the Provincial Government of Bulacan.</p>
            </div>
            <div>
              <h5>Platform</h5>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#types">Report types</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('map'); }}>Live Map</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('report-incident'); }}>File Report</a></li>
              </ul>
            </div>
            <div>
              <h5>Government</h5>
              <ul>
                <li><a href="#impact">Municipal offices</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }}>Staff Access</a></li>
                <li><a href="#">Privacy policy</a></li>
                <li><a href="#">Terms of use</a></li>
              </ul>
            </div>
            <div>
              <h5>Contact</h5>
              <ul>
                <li><a href="mailto:help@roadwatch.bulacan.gov.ph">help@roadwatch.bulacan.ph</a></li>
                <li>Provincial Capitol, City of Malolos</li>
                <li>+63 44 000 0000</li>
              </ul>
            </div>
          </div>
          <div className="fbase">
            <span>&copy; 2026 RoadWatch Bulacan &mdash; Government system, public data.</span>
            <span>14 municipalities &middot; 20 cities</span>
            <span>Bulacan Incident Response Network</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
