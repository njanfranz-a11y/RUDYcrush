import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import OfficerVerificationModal from '../../components/officer/OfficerVerificationModal';
import {
  Eye,
  MapPin,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// Reports in this queue have been dispatched by the Admin but not yet
// decided on by the assigned officer, so they all share the 'assigned' status.
const STATUS_LABEL = {
  assigned: 'Awaiting officer verification',
};

const formatAccidentType = (t) =>
  (t || 'Road incident').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatSeverity = (s) =>
  (s || 'Moderate').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function OfficerVerificationQueuePage({ onSelectReport, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalType, setModalType] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchQueue = (page = 1) => {
    setLoading(true);
    setError('');

    api.officer
      .getVerificationQueue({
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
          <p>Cases assigned to you that still need an officer verification decision.</p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onNavigate('officer-reports')}
          >
            <FileText size={15} /> My assigned cases
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
              Nothing is waiting on your verification
            </div>
            <div style={{ fontSize: '0.84rem' }}>
              Newly assigned cases appear here. Once you verify or reject a report it leaves this queue.
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
                      <span className="status-pill st-progress">
                        {STATUS_LABEL[report.status] || report.status}
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

                        <button
                          type="button"
                          title="Verify report"
                          className="case-verify-btn"
                          onClick={() => openActionModal(report, 'verify')}
                        >
                          <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Verify
                        </button>

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

      {modalType && selectedReport && (
        <OfficerVerificationModal
          report={selectedReport}
          action={modalType}
          onClose={closeModal}
          onDone={() => fetchQueue(pagination?.current_page || 1)}
        />
      )}
    </section>
  );
}
