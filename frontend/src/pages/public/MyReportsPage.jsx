import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FileText, PlusCircle, Search, Filter, AlertCircle, ArrowRight, Calendar, MapPin } from 'lucide-react';

export default function MyReportsPage({ onNavigate, onSelectReport }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState(null);
  // Increment to force a refresh without changing filters
  const [refreshKey, setRefreshKey] = useState(0);

  const getStatusLabel = (st) => {
    if (!st) return 'Pending Verification';
    switch (st) {
      case 'submitted':
        return 'Pending Verification';
      case 'under_review':
        return 'Under Review';
      case 'additional_info_required':
        return 'Info Required';
      case 'verified':
        return 'Verified';
      case 'assigned':
        return 'Assigned';
      case 'in_progress':
        return 'In Progress';
      case 'closed':
        return 'Closed / Resolved';
      case 'rejected':
        return 'Rejected';
      default:
        return st.replace(/_/g, ' ');
    }
  };

  const fetchReports = (page = 1) => {
    setLoading(true);
    api.getMyReports({ status: statusFilter || undefined, search: search || undefined, page })
      .then((res) => {
        if (res.data?.success) {
          setReports(res.data.data.data || []);
          setPagination(res.data.data);
        }
      })
      .catch((err) => console.log('My reports load error:', err.message))
      .finally(() => setLoading(false));
  };

  // Re-fetch whenever the filter changes OR when refreshKey changes (on every mount)
  useEffect(() => {
    fetchReports(1);
  }, [statusFilter, refreshKey]);

  // Re-fetch fresh data each time this page is navigated to
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setRefreshKey(k => k + 1); }, []);

  // Auto-refresh reports every 12s so updates made by officers/admins appear live
  useEffect(() => {
    const timer = setInterval(() => {
      api.getMyReports({ status: statusFilter || undefined, search: search || undefined, page: pagination?.current_page || 1 })
        .then((res) => {
          if (res.data?.success) {
            setReports(res.data.data.data || []);
            setPagination(res.data.data);
          }
        })
        .catch(() => {});
    }, 12000);
    return () => clearInterval(timer);
  }, [pagination?.current_page, statusFilter, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReports(1);
  };

  return (
    <div className="dashboard-container">
      <div>
        <div className="command-eyebrow" style={{ color: '#0284c7' }}>
          <FileText size={14} /> Citizen Submissions &bull; Tracking Desk
        </div>
        <div className="dashboard-title-row">
          <div>
            <h1 className="dashboard-heading">My Submitted Reports</h1>
            <p className="dashboard-subheading">
              Track verification progress, officer assignments, and investigation updates
            </p>
          </div>

          <div className="dashboard-actions" style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => fetchReports(1)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Refresh reports list"
            >
              ↻ Refresh
            </button>
            <button
              className="btn btn-accent"
              onClick={() => onNavigate('report-incident')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '9999px', padding: '10px 20px' }}
            >
              <PlusCircle size={16} /> New Incident Report
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        padding: '16px',
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '24px'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by Report ID, location, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            <Search size={14} /> Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} color="var(--text-muted)" />
          <select
            className="form-control"
            style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="submitted">Pending Verification</option>
            <option value="under_review">Under Review</option>
            <option value="additional_info_required">Info Required</option>
            <option value="verified">Verified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed / Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Report List */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading your incident reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <FileText size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>No Incident Reports Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px auto' }}>
            {statusFilter || search
              ? 'No reports matched your search or status filter.'
              : 'You have not submitted any accident reports yet.'}
          </p>
          <button className="btn btn-accent btn-sm" onClick={() => onNavigate('report-incident')}>
            Report an Incident Now
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className="card"
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '20px 24px'
              }}
              onClick={() => onSelectReport(report.id)}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>
                    {report.report_number}
                  </span>
                  <span className={`badge badge-${report.status}`}>
                    {getStatusLabel(report.status)}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    &bull; {report.accident_type}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px' }}>
                  <MapPin size={14} color="#e11d48" /> {report.location_address}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> {report.accident_date} at {report.accident_time}
                  </span>
                  {report.photos?.length > 0 && (
                    <span>&bull; {report.photos.length} photo(s) attached</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '13px' }}>
                View Details & Timeline <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
