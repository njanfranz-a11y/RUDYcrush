import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import AdminReportActionModal from '../../components/admin/AdminReportActionModal';
import {
  FileText,
  MapPin,
  Eye,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react';

// The admin intake statuses. These are the reports that have not yet been
// verified or rejected, so they still need an administrative decision.
const PENDING_STATUS_CLASS = {
  submitted: 'st-pending',
  under_review: 'st-verify',
  additional_info_required: 'st-pending',
};

const PENDING_STATUS_LABEL = {
  submitted: 'Pending verification',
  under_review: 'Under review',
  additional_info_required: 'Info required',
};

const STATUS_FILTERS = [
  { value: '', label: 'All pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'additional_info_required', label: 'Info required' },
];

const formatAccidentType = (t) =>
  (t || 'Road incident').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatSeverity = (s) =>
  (s || 'Moderate').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminVerificationQueuePage({ onSelectReport, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [officers, setOfficers] = useState([]);

  const [modalType, setModalType] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchQueue = (page = 1) => {
    setLoading(true);
    setError('');

    api.admin
      .getVerificationQueue({
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
      .catch((err) => {
        setReports([]);
        setPagination(null);
        setError(err.friendlyMessage || err.message || 'Failed to load the verification queue.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    api.admin
      .getOfficers()
      .then((res) => {
        if (res.data?.success) setOfficers(res.data.data || []);
      })
      .catch((err) => console.log('Officers fetch error:', err.message));
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchQueue(1);
  };

  const openActionModal = (report, type) => {
    setSelectedReport(report);
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedReport(null);
  };

  // Only these statuses can legally move to "verified" (see
  // AccidentReport::VALID_TRANSITIONS), so the Verify action is hidden for
  // reports waiting on the reporter.
  const canVerify = (status) => status === 'submitted' || status === 'under_review';

  const renderPagination = () => {
    if (!pagination || pagination.last_page <= 1) return null;

    const { current_page, last_page } = pagination;
    const pages = [];

    for (let i = 1; i <= Math.min(last_page, 5); i += 1) pages.push(i);
    if (last_page > 5 && !pages.includes(last_page)) {
      pages.push('…');
      pages.push(last_page);
    }

    return (
      <div className="pg">
        <button
          type="button"
          disabled={current_page <= 1}
          onClick={() => fetchQueue(current_page - 1)}
          aria-label="Previous page"
        >
          &larr;
        </button>

        {pages.map((p, idx) => (
          <button
            key={idx}
            type="button"
            className={p === current_page ? 'on' : ''}
            disabled={typeof p !== 'number'}
            onClick={() => typeof p === 'number' && fetchQueue(p)}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          disabled={current_page >= last_page}
          onClick={() => fetchQueue(current_page + 1)}
          aria-label="Next page"
        >
          &rarr;
        </button>
      </div>
    );
  };

  const pendingCount = pagination?.total ?? reports.length;

  return (
    <section className="panel active dashboard-container">
      {/* PANEL: HEADER */}
      <div className="phead">
        <div>
          <h2 className="hd">Verification Queue</h2>
          <p>Reports awaiting administrative verification and clearance.</p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onNavigate('admin-reports')}
          >
            <FileText size={15} /> Full reports list
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onNavigate('map')}
          >
            <MapPin size={15} style={{ color: 'var(--red)' }} /> Incident map
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="filters">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
          <input
            placeholder="Search report number, location, or reporter…"
            aria-label="Search the verification queue"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <select
          aria-label="Filter by pending status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span className="status-pill st-verify" style={{ marginLeft: 'auto' }}>
          {pendingCount} pending
        </span>
      </div>

      {/* QUEUE TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-mute)' }}>
            Loading verification queue...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', color: 'var(--red)', fontSize: '13.5px' }}>{error}</div>
        ) : reports.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24" />
            </svg>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: '4px' }}>
              Nothing is waiting on verification
            </div>
            <div style={{ fontSize: '0.84rem' }}>
              Every filed report has been verified or rejected. New submissions appear here automatically.
            </div>
          </div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Report #</th>
                  <th>Reported</th>
                  <th>Location</th>
                  <th>Type &amp; severity</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="tid">{report.report_number || `RW-${report.id}`}</td>
                    <td>
                      <div>{report.accident_date || 'Recent'}</div>
                      <div className="tsub">{report.accident_time || 'Recorded'}</div>
                    </td>
                    <td>
                      <div className="tname">
                        {report.location_address || report.landmarks || 'Location unspecified'}
                      </div>
                      <div className="tsub">
                        {report.barangay
                          ? `Brgy. ${report.barangay}`
                          : `Reporter: ${report.reporter_name || 'Anonymous'}`}
                      </div>
                    </td>
                    <td>
                      <div className="tname">{formatAccidentType(report.accident_type)}</div>
                      <div className="tsub">Severity &middot; {formatSeverity(report.injury_severity)}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${PENDING_STATUS_CLASS[report.status] || 'st-pending'}`}>
                        {PENDING_STATUS_LABEL[report.status] || report.status}
                      </span>
                    </td>
                    <td>
                      <div className="rowactions">
                        <button
                          type="button"
                          title="View details"
                          className="case-view-btn"
                          onClick={() => onSelectReport(report.id)}
                        >
                          <Eye size={12} style={{ marginRight: 4 }} /> Details
                        </button>

                        {canVerify(report.status) && (
                          <button
                            type="button"
                            title="Verify report"
                            className="case-verify-btn"
                            onClick={() => openActionModal(report, 'verify')}
                          >
                            <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Verify
                          </button>
                        )}

                        {canVerify(report.status) && (
                          <button
                            type="button"
                            title="Request more information from the reporter"
                            className="case-assign-btn"
                            onClick={() => openActionModal(report, 'request_info')}
                          >
                            <MessageSquare size={12} style={{ marginRight: 4 }} /> Request info
                          </button>
                        )}

                        <button
                          type="button"
                          title="Reject report"
                          className="case-reject-btn"
                          onClick={() => openActionModal(report, 'reject')}
                        >
                          <XCircle size={12} style={{ marginRight: 4 }} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        <div className="pagination">
          <span>
            Showing {reports.length} of {pendingCount} pending reports
          </span>
          {renderPagination()}
        </div>
      </div>

      {/* VERIFY / REJECT / REQUEST INFO SHEET (shared with the Reports page) */}
      {modalType && selectedReport && (
        <AdminReportActionModal
          report={selectedReport}
          action={modalType}
          officers={officers}
          onClose={closeModal}
          onDone={() => fetchQueue(pagination?.current_page || 1)}
        />
      )}
    </section>
  );
}
