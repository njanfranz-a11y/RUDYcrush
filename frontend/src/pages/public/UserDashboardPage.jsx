import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Radio
} from 'lucide-react';

export default function UserDashboardPage({ onNavigate, onSelectReport }) {
  const { user } = useAuth();
  const [myReports, setMyReports] = useState([]);
  const [publicReports, setPublicReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState('12');

  const firstName = user?.name ? user.name.split(' ')[0] : 'Resident';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Refetch every time this component is navigated to (not just first mount)
  const [mountCount, setMountCount] = useState(0);
  useEffect(() => { setMountCount(n => n + 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mountCount === 0) return;
    setLoading(true);
    Promise.all([
      api.getMyReports().catch(() => ({ data: { success: false, data: { data: [] } } })),
      api.getPublicMap().catch(() => ({ data: { success: false, data: [] } }))
    ])
      .then(([myRes, pubRes]) => {
        if (myRes.data?.success) {
          const list = myRes.data.data?.data || myRes.data.data || [];
          setMyReports(Array.isArray(list) ? list : []);
        }
        if (pubRes.data?.success) {
          const pubList = pubRes.data.data || [];
          setPublicReports(Array.isArray(pubList) ? pubList : []);
        }
      })
      .finally(() => setLoading(false));
  }, [mountCount]);

  // Auto-refresh dashboard data every 15s to stay synchronized with DB
  useEffect(() => {
    const timer = setInterval(() => {
      Promise.all([
        api.getMyReports().catch(() => ({ data: { success: false, data: { data: [] } } })),
        api.getPublicMap().catch(() => ({ data: { success: false, data: [] } }))
      ]).then(([myRes, pubRes]) => {
        if (myRes.data?.success) {
          const list = myRes.data.data?.data || myRes.data.data || [];
          setMyReports(Array.isArray(list) ? list : []);
        }
        if (pubRes.data?.success) {
          const pubList = pubRes.data.data || [];
          setPublicReports(Array.isArray(pubList) ? pubList : []);
        }
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Compute User Counts
  const totalFiled = myReports.length;
  const awaitingReview = myReports.filter(r => ['submitted', 'under_review', 'additional_info_required'].includes(r.status)).length;
  const resolvedCount = myReports.filter(r => ['verified', 'assigned', 'in_progress', 'closed', 'resolved'].includes(r.status)).length;

  // Status badge styling helper
  const renderStatusBadge = (status) => {
    const raw = (status || '').toLowerCase();
    if (raw === 'submitted') {
      return <span className="status-pill st-pending">pending verification</span>;
    }
    const s = raw.replace(/_/g, ' ');
    if (s.includes('closed') || s.includes('resolved')) {
      return <span className="status-pill st-resolved">{s}</span>;
    }
    if (s.includes('progress') || s.includes('assigned')) {
      return <span className="status-pill st-progress">{s}</span>;
    }
    if (s.includes('verify')) {
      return <span className="status-pill st-verify">{s}</span>;
    }
    if (s.includes('reject')) {
      return <span className="status-pill st-rejected">{s}</span>;
    }
    return <span className="status-pill st-pending">{s || 'pending verification'}</span>;
  };

  // Severity color helper
  const getSeverityBadge = (severity) => {
    const sev = (severity || 'moderate').toLowerCase();
    let bg = 'rgba(255, 176, 32, 0.15)';
    let color = '#d97706';
    if (sev.includes('critical') || sev.includes('fatal') || sev.includes('severe')) {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#dc2626';
    } else if (sev.includes('high') || sev.includes('serious')) {
      bg = 'rgba(251, 146, 60, 0.15)';
      color = '#ea580c';
    } else if (sev.includes('none') || sev.includes('low') || sev.includes('minor')) {
      bg = 'rgba(34, 197, 94, 0.15)';
      color = '#16a34a';
    }
    return (
      <span style={{
        background: bg,
        color: color,
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}>
        {severity || 'Medium'}
      </span>
    );
  };

  // Recent list to display: user's reports first, followed by public provincial feed
  const displayReports = myReports.length > 0 ? myReports.slice(0, 6) : publicReports.slice(0, 6);

  // Live Activity Items
  const activityFeed = [
    { dot: '#ef4444', text: 'Pothole cluster reported on MacArthur Hwy, Marilao', time: '2m ago' },
    { dot: '#22c55e', text: 'Streetlight repaired and verified in Guiguinto', time: '18m ago' },
    { dot: '#ffb020', text: 'Investigation dispatched for Baliwag–Pulilan corridor', time: '34m ago' },
    { dot: '#fb923c', text: 'Drainage obstruction clearance ongoing in Malolos', time: '52m ago' },
    { dot: '#22c55e', text: 'Road signage inspection closed in Bulakan', time: '1h ago' }
  ];

  return (
    <div className="dashboard-container">
      {/* 1. Header with Greeting and Actions */}
      <div className="phead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="hd" style={{ fontSize: '30px', fontWeight: 800, margin: '0 0 6px', color: 'var(--ink)' }}>
            {getGreeting()}, {firstName}
          </h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14.5px', margin: 0 }}>
            Here's an overview of your road incident reports and provincial activity.
          </p>
        </div>

        <div className="actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onNavigate('map')}
          >
            <MapPin size={15} style={{ marginRight: 6, color: '#e11d48' }} /> Live Incident Map
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => onNavigate('report-incident')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} strokeWidth={2.5} /> File an Incident Report
          </button>
        </div>
      </div>

      {/* 2. 4 Top Metric KPI Cards */}
      <div className="kpi-row-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '24px' }}>
        {/* Card 1: My reports filed */}
        <div className="kpi-stat-card accent-amber">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#fef3c7', color: '#b45309' }}>
            <FileText size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{totalFiled}</div>
            <div className="kpi-stat-lbl">My reports filed</div>
            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
              &uarr; Active tracking
            </div>
          </div>
        </div>

        {/* Card 2: Awaiting review */}
        <div className="kpi-stat-card accent-blue">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Clock size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{awaitingReview}</div>
            <div className="kpi-stat-lbl">Awaiting review</div>
            <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '4px' }}>
              In review queue
            </div>
          </div>
        </div>

        {/* Card 3: Resolved */}
        <div className="kpi-stat-card accent-emerald">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#dcfce7', color: '#15803d' }}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{resolvedCount}</div>
            <div className="kpi-stat-lbl">In progress &amp; resolved</div>
            <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, marginTop: '4px' }}>
              Verified updates
            </div>
          </div>
        </div>

        {/* Card 4: Avg Resolution */}
        <div className="kpi-stat-card accent-purple">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">19 <span style={{ fontSize: '15px', fontWeight: 600 }}>h</span></div>
            <div className="kpi-stat-lbl">Avg. resolution time</div>
            <div style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 600, marginTop: '4px' }}>
              Provincial standard
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Reports Trend and Hazard Categories */}
      <div className="analytics-two-col" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Reports Trend Card */}
        <div className="card">
          <div className="card__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Reports Trend</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: '2px 0 0' }}>Filed vs resolved incidents over time</p>
            </div>
            <div className="chipset" style={{ display: 'flex', gap: '4px' }}>
              {['12W', '6W', '4W'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTrendRange(range)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: trendRange === range ? 'var(--navy-900)' : '#ffffff',
                    color: trendRange === range ? '#ffffff' : 'var(--ink-soft)',
                    cursor: 'pointer'
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="card__body" style={{ padding: '20px' }}>
            <div className="chartwrap" style={{ position: 'relative' }}>
              <svg viewBox="0 0 640 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  <linearGradient id="filedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a6b" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#1e3a6b" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal reference grid lines */}
                <line x1="40" y1="30" x2="620" y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="40" y1="80" x2="620" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="40" y1="130" x2="620" y2="130" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="40" y1="180" x2="620" y2="180" stroke="#cbd5e1" />

                {/* Target Ceiling */}
                <line x1="40" y1="65" x2="620" y2="65" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 4" />

                {/* Shaded Area */}
                <polygon points="40,140 100,125 160,110 220,115 280,95 340,90 400,75 460,70 520,60 580,50 620,45 620,180 40,180" fill="url(#filedGrad)" />

                {/* Filed Line (Navy) */}
                <polyline
                  points="40,140 100,125 160,110 220,115 280,95 340,90 400,75 460,70 520,60 580,50 620,45"
                  fill="none"
                  stroke="#16294d"
                  strokeWidth="3"
                />

                {/* Resolved Line (Amber) */}
                <polyline
                  points="40,150 100,142 160,130 220,132 280,110 340,105 400,95 460,88 520,80 580,72 620,68"
                  fill="none"
                  stroke="#ffb020"
                  strokeWidth="3"
                />

                {/* Line Points */}
                {[[40,140],[100,125],[160,110],[220,115],[280,95],[340,90],[400,75],[460,70],[520,60],[580,50],[620,45]].map(([cx, cy], i) => (
                  <circle key={`f-${i}`} cx={cx} cy={cy} r="4" fill="#16294d" stroke="#ffffff" strokeWidth="2" />
                ))}
                {[[40,150],[100,142],[160,130],[220,132],[280,110],[340,105],[400,95],[460,88],[520,80],[580,72],[620,68]].map(([cx, cy], i) => (
                  <circle key={`r-${i}`} cx={cx} cy={cy} r="4" fill="#ffb020" stroke="#ffffff" strokeWidth="2" />
                ))}
              </svg>
            </div>
            <div className="chart-legend" style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '12px', color: 'var(--ink-soft)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#16294d' }} /> Filed Incidents
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ffb020' }} /> Resolved by Crews
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#22c55e' }} /> Target Resolution Ceiling
              </span>
            </div>
          </div>
        </div>

        {/* By Category Donut Card */}
        <div className="card">
          <div className="card__head" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>By Category</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: '2px 0 0' }}>Distribution of active incidents</p>
          </div>
          <div className="card__body" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
                <svg viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#1e3a6b" strokeWidth="6" strokeDasharray="37.5 62.5" strokeDashoffset="0" />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#38bdf8" strokeWidth="6" strokeDasharray="16.4 83.6" strokeDashoffset="-37.5" />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#ffb020" strokeWidth="6" strokeDasharray="12.7 87.3" strokeDashoffset="-53.9" />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#a78bfa" strokeWidth="6" strokeDasharray="11.5 88.5" strokeDashoffset="-66.6" />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#22c55e" strokeWidth="6" strokeDasharray="12.4 87.6" strokeDashoffset="-78.1" />
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#fb923c" strokeWidth="6" strokeDasharray="9.5 90.5" strokeDashoffset="-90.5" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                  <div>
                    <b style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>1,284</b>
                    <small style={{ fontSize: '10.5px', color: 'var(--ink-mute)', textTransform: 'uppercase', fontWeight: 600 }}>open</small>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: '140px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#1e3a6b' }} /> Road damage
                  </span>
                  <strong style={{ color: 'var(--ink-soft)' }}>37.5%</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#38bdf8' }} /> Flooding
                  </span>
                  <strong style={{ color: 'var(--ink-soft)' }}>16.4%</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ffb020' }} /> Obstruction
                  </span>
                  <strong style={{ color: 'var(--ink-soft)' }}>12.7%</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#a78bfa' }} /> Streetlight
                  </span>
                  <strong style={{ color: 'var(--ink-soft)' }}>11.5%</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#22c55e' }} /> Public structure
                  </span>
                  <strong style={{ color: 'var(--ink-soft)' }}>12.4%</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fb923c' }} /> Signage
                  </span>
                  <strong style={{ color: 'var(--ink-soft)' }}>9.5%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Recent Reports & Live Activity Feed */}
      <div className="analytics-two-col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Recent Reports Table */}
        <div className="card">
          <div className="card__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                {myReports.length > 0 ? 'My Recent Incident Reports' : 'Recent Provincial Incidents'}
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: '2px 0 0' }}>
                {myReports.length > 0 ? 'Track live verification and dispatch status' : 'Latest road safety submissions in Bulacan'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onNavigate('my-reports')}
            >
              View all &rarr;
            </button>
          </div>

          <div className="table-container" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-mute)' }}>Loading reports...</div>
            ) : displayReports.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <FileText size={32} color="#94a3b8" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>No reports filed yet</div>
                <p style={{ color: 'var(--ink-mute)', fontSize: '13px', marginBottom: '14px' }}>
                  Report a pothole, flooding, or road obstruction to notify dispatch crews.
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => onNavigate('report-incident')}
                >
                  File a Report Now
                </button>
              </div>
            ) : (
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th>Hazard Details</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayReports.map((r) => (
                    <tr
                      key={r.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectReport(r.id)}
                    >
                      <td>
                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--navy-600)' }}>
                          {r.report_number || `#${r.id}`}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
                          {r.accident_type || 'Road Incident'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--ink-soft)' }}>
                          📍 {r.location_address || 'Bulacan corridor'}
                        </div>
                      </td>
                      <td>{getSeverityBadge(r.injury_severity || r.severity)}</td>
                      <td>{renderStatusBadge(r.status)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReport(r.id);
                          }}
                        >
                          Details &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Live Activity Feed Card */}
        <div className="card">
          <div className="card__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Live Activity</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: '2px 0 0' }}>Real-time verification events</p>
            </div>
            <span className="badge badge--live"><span className="dot" />Live</span>
          </div>

          <div className="card__body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activityFeed.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #edf2f7'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.dot, marginTop: '5px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.4 }}>{item.text}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--ink-mute)', marginTop: '3px' }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                Have an incident to report?
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => onNavigate('report-incident')}
                style={{ color: 'var(--accent)', fontWeight: 700 }}
              >
                File report &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
