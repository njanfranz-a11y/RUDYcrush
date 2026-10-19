import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { saveBlobResponse, readDownloadError } from '../../services/download';
import {
  Clock,
  Check,
  CheckCircle2,
  Shield,
  XCircle,
  Users,
  FileDown,
  FileText
} from 'lucide-react';

export default function AdminDashboardPage({ onNavigate, onSelectReport }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null); // 'csv' | 'pdf' | null
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const fetchStats = () => {
      api.admin.getStats()
        .then((res) => {
          if (res.data?.success) {
            setStats(res.data.data);
          }
        })
        .catch((err) => console.log('Admin stats error:', err.message))
        .finally(() => setLoading(false));
    };

    fetchStats();
    const timer = setInterval(fetchStats, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleExport = async (kind) => {
    setExporting(kind);
    setExportError('');
    try {
      const response = kind === 'csv'
        ? await api.admin.downloadCsv()
        : await api.admin.downloadPdf();
      await saveBlobResponse(
        response,
        kind === 'csv' ? 'accident_reports.csv' : 'accident_reports.pdf'
      );
    } catch (err) {
      setExportError(await readDownloadError(err));
    } finally {
      setExporting(null);
    }
  };

  const counts = stats?.counts || {};
  const byType = stats?.by_type || [];
  const bySeverity = stats?.by_severity || [];

  // Calculate maximum count for collision types to scale progress bars
  const maxTypeCount = Math.max(...byType.map(t => Number(t.count) || 1), 1);
  const maxSeverityCount = Math.max(...bySeverity.map(s => Number(s.count) || 1), 1);

  // Helper for severity bar colors
  const getSeverityColor = (severity) => {
    const s = String(severity).toLowerCase();
    if (s.includes('none')) return '#10b981'; // Green
    if (s.includes('minor')) return '#f59e0b'; // Amber / Orange
    if (s.includes('severe') || s.includes('fatal')) return '#ef4444'; // Red
    return '#64748b'; // Slate / Unknown
  };

  if (loading) {
    return (
      <div className="dashboard-container" style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ display: 'inline-block', marginBottom: '12px' }}>
          <Shield size={32} color="#7c3aed" />
        </div>
        <div>Loading live telemetry and administrator metrics...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Reference Panel Header */}
      <div className="phead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 className="hd" style={{ fontSize: '29px', fontWeight: 700, margin: '0 0 6px', color: 'var(--ink)' }}>Administrator Dashboard</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px', margin: 0 }}>
            Live road accident telemetry, verification workload, and officer dispatch overview &bull; Province of Bulacan
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn--ghost btn--sm" onClick={() => handleExport('csv')} disabled={exporting !== null}>
            <FileDown size={14} style={{ marginRight: 6 }} /> {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
            <FileText size={14} style={{ marginRight: 6 }} /> {exporting === 'pdf' ? 'Generating…' : 'Generate PDF report'}
          </button>
          <button className="btn btn--dark btn--sm" onClick={() => onNavigate('admin-reports')}>
            Review reports
          </button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          style={{
            margin: '0 0 20px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#991b1b',
            fontSize: '0.85rem',
          }}
        >
          {exportError}
        </div>
      )}

      {/* 6-Column KPI Metrics Row with Top Accent Borders */}
      <div className="kpi-row-grid" style={{ marginBottom: '24px' }}>
        {/* 1: Pending review */}
        <div className="kpi-stat-card accent-amber">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Clock size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.pending || 0}</div>
            <div className="kpi-stat-lbl">Pending review</div>
          </div>
        </div>

        {/* 2: Verified records */}
        <div className="kpi-stat-card accent-green">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#dcfce7', color: '#15803d' }}>
            <Check size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.verified || 0}</div>
            <div className="kpi-stat-lbl">Verified records</div>
          </div>
        </div>

        {/* 3: Active officer cases */}
        <div className="kpi-stat-card accent-blue">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Shield size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.active_investigations || 0}</div>
            <div className="kpi-stat-lbl">Active officer cases</div>
          </div>
        </div>

        {/* 4: Resolved and closed */}
        <div className="kpi-stat-card accent-emerald">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#d1fae5', color: '#047857' }}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.closed || 0}</div>
            <div className="kpi-stat-lbl">Resolved and closed</div>
          </div>
        </div>

        {/* 5: Rejected reports */}
        <div className="kpi-stat-card accent-red">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <XCircle size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.rejected || 0}</div>
            <div className="kpi-stat-lbl">Rejected reports</div>
          </div>
        </div>

        {/* 6: Active traffic officers */}
        <div className="kpi-stat-card accent-purple">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <Users size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.active_officers || 0}</div>
            <div className="kpi-stat-lbl">Active traffic officers</div>
          </div>
        </div>
      </div>

      {/* Reference admin-bars-grid: Collision types & Severity */}
      <div className="g2 admin-bars-grid">
        {/* Collision Type Breakdown */}
        <article className="card">
          <div className="card__head">
            <div>
              <h3>Incidents by collision type</h3>
              <p>Aggregated distribution from live database records</p>
            </div>
          </div>
          <div className="card__body">
            <div className="admin-bars">
              {byType.length === 0 ? (
                <div style={{ color: 'var(--ink-mute)', fontSize: '13px', padding: '12px 0' }}>No collision records logged.</div>
              ) : (
                byType.map((item, idx) => {
                  const count = Number(item.count) || 0;
                  const percentage = Math.max(Math.round((count / maxTypeCount) * 100), 10);
                  return (
                    <div key={idx} className="admin-bar">
                      <div>
                        <b>{item.accident_type}</b>
                        <span>{count} {count === 1 ? 'report' : 'reports'}</span>
                      </div>
                      <i>
                        <u style={{ width: `${percentage}%`, background: '#2864e8' }} />
                      </i>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </article>

        {/* Injury Severity Breakdown */}
        <article className="card">
          <div className="card__head">
            <div>
              <h3>Injury severity breakdown</h3>
              <p>Classification of injuries and vehicle impact levels</p>
            </div>
          </div>
          <div className="card__body">
            <div className="admin-bars severity-bars">
              {bySeverity.length === 0 ? (
                <div style={{ color: 'var(--ink-mute)', fontSize: '13px', padding: '12px 0' }}>No severity records logged.</div>
              ) : (
                bySeverity.map((item, idx) => {
                  const count = Number(item.count) || 0;
                  const percentage = Math.max(Math.round((count / maxSeverityCount) * 100), 10);
                  const barColor = getSeverityColor(item.injury_severity);
                  return (
                    <div key={idx} className="admin-bar">
                      <div>
                        <b style={{ textTransform: 'capitalize' }}>{item.injury_severity}</b>
                        <span>{count} {count === 1 ? 'case' : 'cases'}</span>
                      </div>
                      <i>
                        <u style={{ width: `${percentage}%`, background: barColor }} />
                      </i>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </article>
      </div>

      {/* Reference Admin Shortcuts */}
      <div className="admin-shortcuts">
        <button className="admin-shortcut" onClick={() => onNavigate('admin-reports')}>
          <span className="shortcut-icon amber">&#9636;</span>
          <b>Manage reports</b>
          <small>Verify submissions, assign officers, and archive records.</small>
        </button>

        <button className="admin-shortcut" onClick={() => onNavigate('admin-users')}>
          <span className="shortcut-icon purple">&#9817;</span>
          <b>User and officer management</b>
          <small>Manage staff access, roles, badges, and account status.</small>
        </button>

        <button className="admin-shortcut" onClick={() => onNavigate('map')}>
          <span className="shortcut-icon red">&#8998;</span>
          <b>Interactive incident map</b>
          <small>Review live report locations across Bulacan.</small>
        </button>

        <button className="admin-shortcut" onClick={() => onNavigate('admin-audit-logs')}>
          <span className="shortcut-icon blue">&#11041;</span>
          <b>Security audit trail</b>
          <small>Inspect access logs and case status changes.</small>
        </button>
      </div>
    </div>
  );
}
