import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { saveBlobResponse, readDownloadError } from '../../services/download';
import AdminReportActionModal from '../../components/admin/AdminReportActionModal';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  UserCheck,
  Trash2,
  Eye,
  Calendar,
  FileDown,
  X
} from 'lucide-react';

export default function AdminReportsPage({ onSelectReport }) {
  const [reports, setReports] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  // Filters matching reference HTML
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'unassigned', 'critical'

  // Modal state. The sheet itself owns its form fields and API call.
  const [modalType, setModalType] = useState(null); // 'assign' or 'request_info'
  const [selectedReport, setSelectedReport] = useState(null);

  // Export state so buttons can show progress and surface failures.
  const [exporting, setExporting] = useState(null); // 'csv' | 'pdf' | null
  const [exportError, setExportError] = useState('');

  // Permanent-delete confirmation state. Nothing is sent to the API until the
  // Admin explicitly presses "Delete Permanently".
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text }

  const fetchReports = (page = 1) => {
    setLoading(true);
    api.admin.getReports({
      status: statusFilter || undefined,
      search: search || undefined,
      severity: severityFilter || undefined,
      accident_type: typeFilter || undefined,
      page
    })
      .then((res) => {
        if (res.data?.success) {
          setReports(res.data.data.data || []);
          setPagination(res.data.data);
        }
      })
      .catch((err) => console.log('Admin reports error:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports(1);
    // Fetch traffic officers for assignment dropdown
    api.admin.getOfficers()
      .then((res) => {
        if (res.data?.success) {
          setOfficers(res.data.data || []);
        }
      })
      .catch((err) => console.log('Officers fetch error:', err.message));
  }, [statusFilter, severityFilter, typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReports(1);
  };

  const openActionModal = (report, type) => {
    setSelectedReport(report);
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedReport(null);
  };

  const handleExport = async (kind) => {
    setExporting(kind);
    setExportError('');

    try {
      // Send the active filters so the file matches the on-screen list.
      const params = {
        status: statusFilter || undefined,
        search: search || undefined,
        severity: severityFilter || undefined,
        accident_type: typeFilter || undefined,
      };

      const response = kind === 'csv'
        ? await api.admin.downloadCsv(params)
        : await api.admin.downloadPdf(params);

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

  const openDeleteModal = (report) => {
    setDeleteTarget(report);
    setDeleteError('');
    setNotice(null);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    setDeleteError('');
    setNotice(null);

    try {
      const response = await api.admin.deleteReport(deleteTarget.id);

      // If the deleted row was the only item on a later page, step back one
      // page so the table does not land on an empty page.
      const currentPage = pagination?.current_page || 1;
      const targetPage = reports.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;

      setDeleteTarget(null);
      setNotice({
        type: 'success',
        text: response.data?.message || 'Incident report permanently deleted.',
      });
      fetchReports(targetPage);
    } catch (err) {
      setDeleteError(err.friendlyMessage || err.message || 'Failed to delete report.');
    } finally {
      setDeleting(false);
    }
  };

  // Escape closes the confirmation sheet without deleting anything.
  useEffect(() => {
    if (!deleteTarget) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !deleting) {
        setDeleteTarget(null);
        setDeleteError('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, deleting]);

  // Status badge styling helper
  const getStatusPillClass = (st) => {
    switch (st) {
      case 'submitted':
      case 'pending':
        return 'st-pending';
      case 'under_review':
      case 'verified':
        return 'st-verify';
      case 'assigned':
      case 'in_progress':
        return 'st-progress';
      case 'closed':
      case 'resolved':
        return 'st-resolved';
      case 'rejected':
        return 'st-rejected';
      case 'additional_info_required':
        return 'st-pending';
      default:
        return 'st-off';
    }
  };

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
        return 'Resolved';
      case 'rejected':
        return 'Rejected';
      default:
        return st.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const formatAccidentType = (t) => {
    if (!t) return 'Road Incident';
    return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatSeverity = (s) => {
    if (!s) return 'Moderate';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Quick filter on currently loaded reports
  const filteredReports = reports.filter((r) => {
    if (quickFilter === 'unassigned') {
      return !r.assigned_officer;
    }
    if (quickFilter === 'critical') {
      const sev = (r.injury_severity || '').toLowerCase();
      return sev.includes('fatal') || sev.includes('severe') || sev.includes('critical');
    }
    return true;
  });

  // Calculate pagination page items
  const renderPaginationButtons = () => {
    if (!pagination) return null;
    const { current_page, last_page } = pagination;
    const pages = [];

    for (let i = 1; i <= Math.min(last_page, 5); i++) {
      pages.push(i);
    }
    if (last_page > 5) {
      if (!pages.includes(last_page)) {
        pages.push('…');
        pages.push(last_page);
      }
    }

    return (
      <div className="pg">
        <button
          type="button"
          disabled={current_page <= 1}
          onClick={() => fetchReports(current_page - 1)}
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
            onClick={() => typeof p === 'number' && fetchReports(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={current_page >= last_page}
          onClick={() => fetchReports(current_page + 1)}
          aria-label="Next page"
        >
          &rarr;
        </button>
      </div>
    );
  };

  return (
    <section className="panel active dashboard-container" id="panel-reports">
      {/* PANEL: REPORTS HEADER */}
      <div className="phead">
        <div>
          <h2 className="hd">Reports</h2>
          <p>Searchable record of every filed incident and its disposition.</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            id="btnExport2"
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
          >
            <FileText size={15} />
            {exporting === 'pdf' ? 'Generating…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '0 0 14px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#991b1b',
            fontSize: '0.85rem',
          }}
        >
          <XCircle size={16} />
          <span>{exportError}</span>
        </div>
      )}

      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '0 0 14px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: notice.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: notice.type === 'error' ? '#991b1b' : '#166534',
            fontSize: '0.85rem',
          }}
        >
          {notice.type === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* FILTERS & SEARCH ROW */}
      <div className="filters">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
          <input
            placeholder="Search ID, location, reporter…"
            id="repSearch"
            aria-label="Search reports"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <select
          id="repStatus"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="submitted">Pending</option>
          <option value="under_review">Verification</option>
          <option value="additional_info_required">Info required</option>
          <option value="verified">Verified</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          id="repSev"
          aria-label="Filter by severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="">All severities</option>
          <option value="fatal">Critical / Fatal</option>
          <option value="serious">High / Serious</option>
          <option value="minor">Medium / Minor</option>
          <option value="none">Low / None</option>
        </select>

        <select
          id="repType"
          aria-label="Filter by category"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All categories</option>
          <option value="collision">Road damage / Collision</option>
          <option value="flooding">Flooding</option>
          <option value="obstruction">Obstruction</option>
          <option value="hit_and_run">Hit-and-run</option>
          <option value="pedestrian">Pedestrian</option>
          <option value="motorcycle">Motorcycle</option>
          <option value="property_damage">Property damage</option>
        </select>

        <div className="chipset" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className={quickFilter === 'all' ? 'on' : ''}
            onClick={() => {
              setQuickFilter('all');
              setStatusFilter('');
              setSeverityFilter('');
            }}
          >
            All
          </button>
          <button
            type="button"
            className={quickFilter === 'unassigned' ? 'on' : ''}
            onClick={() => setQuickFilter('unassigned')}
          >
            Unassigned
          </button>
          <button
            type="button"
            className={quickFilter === 'critical' ? 'on' : ''}
            onClick={() => setQuickFilter('critical')}
          >
            Critical
          </button>
        </div>
      </div>

      {/* REPORTS DATA TABLE CARD */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-mute)' }}>
            Loading incident records...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: '4px' }}>
              No reports match your filters
            </div>
            <div style={{ fontSize: '0.84rem' }}>Try clearing your search query or selecting a different status filter.</div>
          </div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Report #</th>
                  <th>Date &amp; time</th>
                  <th>Location</th>
                  <th>Type &amp; severity</th>
                  <th>Status</th>
                  <th>Assigned officer</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody id="repBody">
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td className="tid">
                      {report.report_number || `RW-${report.id}`}
                    </td>
                    <td>
                      <div>{report.accident_date || 'Recent'}</div>
                      <div className="tsub">{report.accident_time || 'Recorded'}</div>
                    </td>
                    <td>
                      <div className="tname">
                        {report.location_address || report.landmarks || 'Location unspecified'}
                      </div>
                      <div className="tsub">
                        {report.barangay ? `Brgy. ${report.barangay}` : `Reporter: ${report.reporter_name || 'Anonymous'}`}
                      </div>
                    </td>
                    <td>
                      <div className="tname">
                        {formatAccidentType(report.accident_type)}
                      </div>
                      <div className="tsub">
                        Severity &middot; {formatSeverity(report.injury_severity)}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${getStatusPillClass(report.status)}`}>
                        {getStatusLabel(report.status)}
                      </span>
                    </td>
                    <td>
                      {report.assigned_officer ? (
                        <div style={{ fontWeight: 500, color: 'var(--ink)' }}>
                          {report.assigned_officer.name}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ink-mute)', fontSize: '0.84rem' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="rowactions">
                        <button
                          type="button"
                          title="View details"
                          className="case-view-btn"
                          onClick={() => onSelectReport(report.id)}
                        >
                          View
                        </button>

                        {/* Admin assigns or reassigns; verification and
                            rejection belong to the assigned officer. */}
                        {!['closed', 'rejected'].includes(report.status) && (
                          <button
                            type="button"
                            title={report.assigned_officer ? 'Reassign officer' : 'Assign officer'}
                            className="case-assign-btn"
                            onClick={() => openActionModal(report, 'assign')}
                          >
                            {report.assigned_officer ? 'Reassign' : 'Assign'}
                          </button>
                        )}

                        {/* Permanent delete (confirmation required) */}
                        <button
                          type="button"
                          title="Delete permanently"
                          aria-label={`Delete report ${report.report_number || report.id}`}
                          className="case-delete-btn"
                          onClick={() => openDeleteModal(report)}
                        >
                          <Trash2 size={13} />
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
          <span id="repCount">
            Showing {filteredReports.length} of {pagination?.total || reports.length}
          </span>
          {renderPaginationButtons()}
        </div>
      </div>

      {/* ACTION MODAL (ASSIGN / REQUEST INFO) */}
      {modalType && selectedReport && (
        <AdminReportActionModal
          report={selectedReport}
          action={modalType}
          officers={officers}
          onClose={closeModal}
          onDone={() => fetchReports(pagination?.current_page || 1)}
        />
      )}

      {/* PERMANENT DELETE CONFIRMATION */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteReportTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet__head">
              <div>
                <h3 id="deleteReportTitle">Delete Incident Report</h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                  Permanent deletion
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeDeleteModal}
                disabled={deleting}
                aria-label="Cancel and close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="sheet__body">
              <div
                style={{
                  display: 'grid',
                  gap: '10px',
                  padding: '14px 16px',
                  marginBottom: '18px',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                    Report ID
                  </div>
                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--navy-600)' }}>
                    {deleteTarget.report_number || `RW-${deleteTarget.id}`}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                    Incident
                  </div>
                  <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                    {formatAccidentType(deleteTarget.accident_type)}
                  </strong>
                  <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                    {deleteTarget.location_address || 'Location not recorded'}
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, color: 'var(--ink)', fontSize: '14px', lineHeight: 1.6 }}>
                Are you sure you want to permanently delete this incident report? This action cannot be undone.
              </p>

              {deleteError && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginTop: '16px',
                    padding: '10px 14px',
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: '13px',
                  }}
                >
                  <XCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div className="sheet__foot">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={confirmDelete}
                disabled={deleting}
              >
                <Trash2 size={14} style={{ marginRight: 6 }} />
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
