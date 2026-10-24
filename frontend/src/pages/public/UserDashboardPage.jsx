import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import IncidentReportModal from '../../components/reports/IncidentReportModal';
import {
  FileText,
  Clock,
  CheckCircle2,
  Plus,
  TrendingUp,
  MapPin,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';

const CATEGORY_COLORS = [
  '#1e3a6b',
  '#38bdf8',
  '#ffb020',
  '#a78bfa',
  '#22c55e',
  '#fb923c',
  '#ef4444',
  '#14b8a6',
];

export default function UserDashboardPage({ onNavigate, onSelectReport }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState('');
  const [trendRange, setTrendRange] = useState(12);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState(null);
  const dashboardLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Resident';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // One endpoint feeds every card and chart, so all values use the same
  // owner-scoped snapshot from the database.
  const loadDashboard = useCallback(async (weeks, { background = false } = {}) => {
    const requestId = ++requestIdRef.current;

    if (!background) {
      if (dashboardLoadedRef.current) {
        setChartLoading(true);
      } else {
        setLoading(true);
      }
    }

    try {
      const res = await api.getMyDashboard({ weeks });
      if (requestId !== requestIdRef.current) return;

      if (res.data?.success) {
        setDashboard(res.data.data);
        dashboardLoadedRef.current = true;
        setError('');
      } else {
        setError('Unable to load dashboard data.');
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.friendlyMessage || err.message || 'Unable to load dashboard data.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setChartLoading(false);
      }
    }
  }, []);

  const handleReportSubmitted = useCallback(({ report, duplicateCheckNote }) => {
    setReportModalOpen(false);
    setReportNotice({
      reportNumber: report?.report_number || (report?.id ? `#${report.id}` : ''),
      duplicateCheckNote: duplicateCheckNote || '',
    });

    // Refresh the KPIs, charts, category breakdown and recent reports from the
    // same source that the newly created report was saved to.
    loadDashboard(trendRange, { background: true });
  }, [loadDashboard, trendRange]);

  useEffect(() => {
    if (!reportNotice) return undefined;
    const timer = setTimeout(() => setReportNotice(null), 12000);
    return () => clearTimeout(timer);
  }, [reportNotice]);

  useEffect(() => {
    loadDashboard(trendRange);
  }, [trendRange, loadDashboard]);

  // Auto-refresh quietly every 15s so charts stay synchronized with the DB.
  useEffect(() => {
    const timer = setInterval(
      () => loadDashboard(trendRange, { background: true }),
      15000
    );
    return () => clearInterval(timer);
  }, [trendRange, loadDashboard]);

  const counts = dashboard?.counts || {};
  const totalFiled = counts.total ?? 0;
  const awaitingReview = counts.awaiting_review ?? 0;
  const resolvedCount = counts.in_progress_and_resolved ?? 0;
  const averageResolution = dashboard?.average_resolution_hours;
  const trendBuckets = dashboard?.trend?.buckets || [];
  const byCategory = dashboard?.by_category || [];
  const recentReports = dashboard?.recent_reports || [];

  const hasTrendData = trendBuckets.some(
    (bucket) => Number(bucket.filed) > 0 || Number(bucket.resolved) > 0
  );

  // Donut geometry. Percentages come from the API and always add up to the
  // Resident's own report total (subject to normal rounding).
  const categorySegments = byCategory.reduce((segments, category, index) => {
    const percentage = Number(category.percentage) || 0;
    const previous = segments[segments.length - 1];
    const dashOffset = previous
      ? previous.dashOffset - (Number(previous.percentage) || 0)
      : 0;

    segments.push({
      ...category,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      dashArray: `${percentage} ${100 - percentage}`,
      dashOffset,
    });
    return segments;
  }, []);

  // Trend chart geometry, scaled to the largest weekly value.
  const chart = {
    left: 48,
    right: 620,
    top: 24,
    bottom: 180,
    width: 640,
    height: 220,
  };
  const maxTrendValue = Math.max(
    4,
    ...trendBuckets.flatMap((bucket) => [Number(bucket.filed) || 0, Number(bucket.resolved) || 0])
  );
  const yMax = Math.ceil(maxTrendValue / 4) * 4;
  const xFor = (index) => {
    if (trendBuckets.length <= 1) {
      return (chart.left + chart.right) / 2;
    }
    return chart.left + (index * (chart.right - chart.left)) / (trendBuckets.length - 1);
  };
  const yFor = (value) => (
    chart.bottom - ((Number(value) || 0) / yMax) * (chart.bottom - chart.top)
  );
  const filedPoints = trendBuckets.map((bucket, index) => [xFor(index), yFor(bucket.filed)]);
  const resolvedPoints = trendBuckets.map((bucket, index) => [xFor(index), yFor(bucket.resolved)]);
  const toPolyline = (points) => points.map((point) => point.join(',')).join(' ');
  const filedPolyline = toPolyline(filedPoints);
  const resolvedPolyline = toPolyline(resolvedPoints);
  const areaPolygon = filedPoints.length > 0
    ? `${toPolyline(filedPoints)} ${chart.right},${chart.bottom} ${chart.left},${chart.bottom}`
    : '';
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
    value: Math.round(yMax * fraction),
    y: yFor(yMax * fraction),
  }));
  const xLabelEvery = Math.max(1, Math.ceil(trendBuckets.length / 6));

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

  // Only the signed-in resident's own submissions belong in this table.
  // There is deliberately no public-feed fallback: another resident's report
  // must never appear on this dashboard.
  const displayReports = recentReports.slice(0, 6);

  // Live Activity Items
  const activityFeed = [
    { dot: '#ef4444', text: 'Pothole cluster reported on MacArthur Hwy, Marilao', time: '2m ago' },
    { dot: '#22c55e', text: 'Streetlight repaired and verified in Guiguinto', time: '18m ago' },
    { dot: '#ffb020', text: 'Investigation dispatched for Baliwag–Pulilan corridor', time: '34m ago' },
    { dot: '#fb923c', text: 'Drainage obstruction clearance ongoing in Malolos', time: '52m ago' },
    { dot: '#22c55e', text: 'Road signage inspection closed in Bulakan', time: '1h ago' }
  ];

  if (loading && !dashboard) {
    return (
      <div className="dashboard-container" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
        <Clock size={30} style={{ margin: '0 auto 12px auto', display: 'block', color: '#94a3b8' }} />
        <div>Loading your dashboard data...</div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="dashboard-container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <AlertCircle size={32} style={{ margin: '0 auto 12px auto', display: 'block', color: '#dc2626' }} />
        <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
          Unable to load your dashboard
        </div>
        <p style={{ color: 'var(--ink-mute)', fontSize: '13px', margin: '0 0 16px' }}>{error}</p>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => loadDashboard(trendRange)}
        >
          <RefreshCw size={14} style={{ marginRight: 6 }} /> Try again
        </button>
      </div>
    );
  }

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
            onClick={() => setReportModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} strokeWidth={2.5} /> File an Incident Report
          </button>
        </div>
      </div>

      {reportNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            margin: '0 0 20px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1 }}>
            <strong>Incident report submitted successfully.</strong>
            {reportNotice.reportNumber ? (
              <span> Reference: {reportNotice.reportNumber}.</span>
            ) : null}
            {reportNotice.duplicateCheckNote ? (
              <div style={{ marginTop: '4px', color: '#92400e', lineHeight: 1.5 }}>
                {reportNotice.duplicateCheckNote}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={() => setReportNotice(null)}
            aria-label="Dismiss success notification"
            style={{ width: '26px', height: '26px', flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
              {totalFiled > 0 ? 'Active tracking' : 'No reports filed yet'}
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
              {awaitingReview > 0 ? 'In review queue' : 'Nothing awaiting review'}
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
              {resolvedCount > 0 ? 'Verified, working, or closed' : 'No active cases yet'}
            </div>
          </div>
        </div>

        {/* Card 4: Avg Resolution */}
        <div className="kpi-stat-card accent-purple">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">
              {averageResolution !== null && averageResolution !== undefined
                ? <>{averageResolution} <span style={{ fontSize: '15px', fontWeight: 600 }}>h</span></>
                : '—'}
            </div>
            <div className="kpi-stat-lbl">Avg. resolution time</div>
            <div style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 600, marginTop: '4px' }}>
              {averageResolution !== null && averageResolution !== undefined
                ? 'Based on your closed reports'
                : 'No closed reports yet'}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: '0 0 18px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => loadDashboard(trendRange)}
            style={{ color: '#991b1b' }}
          >
            Retry
          </button>
        </div>
      )}

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
              {['12W', '6W', '4W'].map((range) => {
                const weeks = Number(range.replace('W', ''));
                const active = trendRange === weeks;

                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTrendRange(weeks)}
                    aria-pressed={active}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: active ? 'var(--navy-900)' : '#ffffff',
                      color: active ? '#ffffff' : 'var(--ink-soft)',
                      cursor: 'pointer'
                    }}
                  >
                    {range}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card__body" style={{ padding: '20px' }}>
            {chartLoading ? (
              <div style={{ minHeight: '220px', display: 'grid', placeItems: 'center', color: 'var(--ink-mute)', fontSize: '13px' }}>
                Loading {trendRange}-week trend...
              </div>
            ) : !hasTrendData ? (
              <div style={{ minHeight: '220px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '20px' }}>
                <div>
                  <TrendingUp size={28} color="#94a3b8" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                    No reports filed in this period
                  </div>
                  <p style={{ color: 'var(--ink-mute)', fontSize: '12.5px', margin: 0 }}>
                    Try a longer range or submit a new incident report.
                  </p>
                </div>
              </div>
            ) : (
              <div className="chartwrap" style={{ position: 'relative' }}>
                <svg
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  role="img"
                  aria-label={`Reports filed and resolved over the last ${trendRange} weeks`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <linearGradient id="residentFiledGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a6b" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#1e3a6b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {yTicks.map((tick, index) => (
                    <g key={`y-${index}`}>
                      <line
                        x1={chart.left}
                        y1={tick.y}
                        x2={chart.right}
                        y2={tick.y}
                        stroke={tick.value === 0 ? '#cbd5e1' : '#e2e8f0'}
                        strokeDasharray={tick.value === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={chart.left - 8}
                        y={tick.y + 4}
                        textAnchor="end"
                        fontSize="10.5"
                        fill="var(--ink-mute)"
                      >
                        {tick.value}
                      </text>
                    </g>
                  ))}

                  {areaPolygon && (
                    <polygon points={areaPolygon} fill="url(#residentFiledGrad)" />
                  )}

                  <polyline
                    points={filedPolyline}
                    fill="none"
                    stroke="#16294d"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  <polyline
                    points={resolvedPolyline}
                    fill="none"
                    stroke="#ffb020"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {filedPoints.map(([cx, cy], index) => (
                    <circle
                      key={`f-${index}`}
                      cx={cx}
                      cy={cy}
                      r="4"
                      fill="#16294d"
                      stroke="#ffffff"
                      strokeWidth="2"
                    >
                      <title>{`${trendBuckets[index].label}: ${trendBuckets[index].filed} filed`}</title>
                    </circle>
                  ))}

                  {resolvedPoints.map(([cx, cy], index) => (
                    <circle
                      key={`r-${index}`}
                      cx={cx}
                      cy={cy}
                      r="4"
                      fill="#ffb020"
                      stroke="#ffffff"
                      strokeWidth="2"
                    >
                      <title>{`${trendBuckets[index].label}: ${trendBuckets[index].resolved} resolved`}</title>
                    </circle>
                  ))}

                  {trendBuckets.map((bucket, index) => (
                    index % xLabelEvery === 0 ? (
                      <text
                        key={`x-${index}`}
                        x={xFor(index)}
                        y={chart.height - 8}
                        textAnchor="middle"
                        fontSize="10.5"
                        fill="var(--ink-mute)"
                      >
                        {bucket.label}
                      </text>
                    ) : null
                  ))}
                </svg>
              </div>
            )}
            <div className="chart-legend" style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '12px', color: 'var(--ink-soft)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#16294d' }} /> Filed Incidents
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ffb020' }} /> Resolved by Crews
              </span>
            </div>
          </div>
        </div>

        {/* By Category Donut Card */}
        <div className="card">
          <div className="card__head" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>By Category</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: '2px 0 0' }}>Distribution of your reports</p>
          </div>
          <div className="card__body" style={{ padding: '20px' }}>
            {byCategory.length === 0 ? (
              <div style={{ minHeight: '150px', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>No category data yet</div>
                  <p style={{ color: 'var(--ink-mute)', fontSize: '12.5px', margin: 0 }}>
                    Categories will appear after you file a report.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
                  <svg viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                    {categorySegments.map((segment, index) => (
                      <circle
                        key={`${segment.name}-${index}`}
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth="6"
                        strokeDasharray={segment.dashArray}
                        strokeDashoffset={segment.dashOffset}
                      >
                        <title>{`${segment.name}: ${segment.count} (${segment.percentage}%)`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                    <div>
                      <b style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>{totalFiled}</b>
                      <small style={{ fontSize: '10.5px', color: 'var(--ink-mute)', textTransform: 'uppercase', fontWeight: 600 }}>reports</small>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: '140px', fontSize: '12.5px' }}>
                  {categorySegments.map((category, index) => (
                    <div key={`${category.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: category.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</span>
                      </span>
                      <strong style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                        {category.count} &middot; {category.percentage}%
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                My Recent Incident Reports
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: '2px 0 0' }}>
                Track live verification and dispatch status of your submissions
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
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>You haven't submitted any incident reports yet</div>
                <p style={{ color: 'var(--ink-mute)', fontSize: '13px', marginBottom: '14px' }}>
                  Report a pothole, flooding, or road obstruction to notify dispatch crews.
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => setReportModalOpen(true)}
                >
                  Submit a New Report
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
                onClick={() => setReportModalOpen(true)}
                style={{ color: 'var(--accent)', fontWeight: 700 }}
              >
                File report &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportModalOpen && (
        <IncidentReportModal
          onClose={() => setReportModalOpen(false)}
          onSubmitted={handleReportSubmitted}
        />
      )}
    </div>
  );
}
