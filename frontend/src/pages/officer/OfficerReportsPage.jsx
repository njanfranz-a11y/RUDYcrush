import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import OfficerStatusUpdateModal from '../../components/officer/OfficerStatusUpdateModal';
import {
  Eye,
  Shield,
  MapPin
} from 'lucide-react';

const STATUS_CLASS = {
  submitted: 'st-pending',
  under_review: 'st-verify',
  additional_info_required: 'st-pending',
  verified: 'st-resolved',
  assigned: 'st-progress',
  in_progress: 'st-progress',
  closed: 'st-resolved',
  rejected: 'st-rejected',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
];

export default function OfficerReportsPage({ onSelectReport, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeReport, setActiveReport] = useState(null);

  const fetchReports = (page = 1) => {
    setLoading(true);
    api.officer.getAssignedReports({
      status: statusFilter || undefined,
      search: search || undefined,
      page,
    })
      .then((res) => {
        if (res.data?.success) {
          setReports(res.data.data.data || []);
          setPagination(res.data.data);
        }
      })
      .catch((err) => console.log('Officer reports error:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports(1);
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReports(1);
  };

  const handleUpdated = () => {
    setActiveReport(null);
    fetchReports(pagination?.current_page || 1);
  };

  return (
    <div className="dashboard-container">
      <div className="phead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 className="hd" style={{ fontSize: '29px', fontWeight: 700, margin: '0 0 6px', color: 'var(--ink)' }}>Reports</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px', margin: 0 }}>
            Manage and review every accident report assigned to your badge
          </p>
        </div>

        <div className="actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn--ghost btn--sm" onClick={() => onNavigate('officer-dashboard')}>
            <Shield size={14} style={{ marginRight: 6 }} /> Officer dashboard
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => onNavigate('map')}>
            <MapPin size={14} style={{ marginRight: 6, color: 'var(--red)' }} /> View incident map
          </button>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: '16px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
          <input
            placeholder="Search by report number, location, or collision type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reports"
          />
        </form>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="card officer-cases" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3>Assigned reports</h3>
            <p>Full case history for investigations delegated to you</p>
          </div>
          <span className="status-pill st-progress">
            {pagination?.total ?? reports.length} total
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            Loading assigned reports...
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            No incident reports are currently assigned to your badge.
          </div>
        ) : (
          <div className="tablewrap" style={{ overflowX: 'auto' }}>
            <table className="officer-case-table">
              <thead>
                <tr>
                  <th>Report #</th>
                  <th>Date &amp; time</th>
                  <th>Location</th>
                  <th>Collision type</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="tid">
                      <b>{report.report_number}</b>
                    </td>
                    <td>
                      {report.accident_date}<br />
                      <small>{report.accident_time || 'Recorded'}</small>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {report.location_address}
                      </div>
                      <small>Reporter: {report.reporter_name} ({report.reporter_contact || 'None'})</small>
                    </td>
                    <td>
                      <div>{report.accident_type}</div>
                      <small>Vehicles: {report.vehicles_involved || 1}</small>
                    </td>
                    <td>
                      <span className={`status-pill ${STATUS_CLASS[report.status] || 'st-verify'}`}>
                        {report.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="rowactions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="officer-detail"
                          onClick={() => onSelectReport(report.id)}
                        >
                          <Eye size={12} style={{ marginRight: 5 }} /> Details
                        </button>

                        {report.status === 'assigned' && (
                          <button
                            className="officer-update"
                            onClick={() => onNavigate('officer-verification')}
                          >
                            Verify
                          </button>
                        )}

                        {['verified', 'in_progress'].includes(report.status) && (
                          <button
                            className="officer-update"
                            onClick={() => setActiveReport(report)}
                          >
                            Update status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.last_page > 1 && (
          <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              Page {pagination.current_page} of {pagination.last_page} &bull; {pagination.total} reports
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn--ghost btn--sm"
                disabled={pagination.current_page <= 1 || loading}
                onClick={() => fetchReports(pagination.current_page - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn--ghost btn--sm"
                disabled={pagination.current_page >= pagination.last_page || loading}
                onClick={() => fetchReports(pagination.current_page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {activeReport && (
        <OfficerStatusUpdateModal
          report={activeReport}
          onClose={() => setActiveReport(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}