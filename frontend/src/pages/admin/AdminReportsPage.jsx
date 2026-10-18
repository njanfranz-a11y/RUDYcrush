import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  UserCheck,
  AlertCircle,
  Trash2,
  Eye,
  Calendar,
  X,
  FileDown
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

  // Modals state
  const [modalType, setModalType] = useState(null); // 'verify', 'reject', 'assign', 'request_info'
  const [selectedReport, setSelectedReport] = useState(null);
  const [formInput, setFormInput] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setFormInput('');
    setSelectedOfficerId(officers[0]?.id || '');
    setModalError('');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedReport(null);
    setFormInput('');
    setModalError('');
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      if (modalType === 'verify') {
        await api.admin.verifyReport(selectedReport.id, { official_remarks: formInput });
      } else if (modalType === 'reject') {
        if (!formInput.trim()) {
          setModalError('A rejection reason is strictly required.');
          setSubmitting(false);
          return;
        }
        await api.admin.rejectReport(selectedReport.id, { rejection_reason: formInput });
      } else if (modalType === 'assign') {
        if (!selectedOfficerId) {
          setModalError('Please select an active traffic officer.');
          setSubmitting(false);
          return;
        }
        await api.admin.assignOfficer(selectedReport.id, {
          officer_id: selectedOfficerId,
          assignment_notes: formInput
        });
      } else if (modalType === 'request_info') {
        if (!formInput.trim()) {
          setModalError('Please state what additional details are needed from the reporter.');
          setSubmitting(false);
          return;
        }
        await api.admin.requestInfo(selectedReport.id, { notes: formInput });
      } else if (modalType === 'close') {
        await api.admin.closeReport(selectedReport.id, {
          official_remarks: formInput,
          actions_taken: formInput || 'Incident resolved and case closed by administrator.'
        });
      }

      closeModal();
      fetchReports(pagination?.current_page || 1);
    } catch (err) {
      setModalError(err.friendlyMessage || err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id, reportNumber) => {
    if (window.confirm(`Are you sure you want to soft-delete / archive report ${reportNumber}? It can be recovered by database administrators.`)) {
      try {
        await api.admin.deleteReport(id);
        fetchReports(pagination?.current_page || 1);
      } catch (err) {
        alert(err.friendlyMessage || err.message || 'Failed to archive report.');
      }
    }
  };

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
            onClick={() => window.open(api.admin.getCsvExportUrl(), '_blank')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => window.open(api.admin.getPdfExportUrl(), '_blank')}
          >
            <FileText size={15} />
            Export PDF
          </button>
        </div>
      </div>

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

                        {/* Verify button for unverified items */}
                        {['submitted', 'under_review'].includes(report.status) && (
                          <button
                            type="button"
                            title="Verify report"
                            className="case-verify-btn"
                            onClick={() => openActionModal(report, 'verify')}
                          >
                            Verify
                          </button>
                        )}

                        {/* Assign officer button */}
                        {['verified', 'assigned'].includes(report.status) && (
                          <button
                            type="button"
                            title="Assign officer"
                            className="case-assign-btn"
                            onClick={() => openActionModal(report, 'assign')}
                          >
                            Assign
                          </button>
                        )}

                        {/* Resolve / Close button */}
                        {['verified', 'assigned', 'in_progress'].includes(report.status) && (
                          <button
                            type="button"
                            title="Resolve and close report"
                            className="case-verify-btn"
                            style={{ background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }}
                            onClick={() => openActionModal(report, 'close')}
                          >
                            Resolve
                          </button>
                        )}

                        {/* Reject button */}
                        {['submitted', 'under_review', 'additional_info_required'].includes(report.status) && (
                          <button
                            type="button"
                            title="Reject report"
                            className="case-reject-btn"
                            onClick={() => openActionModal(report, 'reject')}
                          >
                            Reject
                          </button>
                        )}

                        {/* Soft delete */}
                        <button
                          type="button"
                          title="Archive / Soft Delete"
                          className="case-delete-btn"
                          onClick={() => handleArchive(report.id, report.report_number)}
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

      {/* ACTION MODAL (VERIFY / REJECT / ASSIGN / REQUEST INFO) */}
      {modalType && selectedReport && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet__head">
              <div>
                <h3>
                  {modalType === 'verify' && `Verify Report ${selectedReport.report_number || selectedReport.id}`}
                  {modalType === 'close' && `Resolve & Close Report ${selectedReport.report_number || selectedReport.id}`}
                  {modalType === 'reject' && `Reject Report ${selectedReport.report_number || selectedReport.id}`}
                  {modalType === 'assign' && `Assign Officer to ${selectedReport.report_number || selectedReport.id}`}
                  {modalType === 'request_info' && `Request Additional Information`}
                </h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                  {selectedReport.location_address || 'Bulacan incident verification'}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div style={{
                margin: '16px 24px 0',
                padding: '10px 14px',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} /> <div>{modalError}</div>
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              <div className="sheet__body">
                {modalType === 'verify' && (
                  <div className="field">
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                      Official Remarks / Command Center Verification
                    </label>
                    <textarea
                      rows="3"
                      className="form-control"
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit' }}
                      placeholder="e.g. Incident verified via Bulacan Command Center CCTV feed. No immediate road blockage."
                      value={formInput}
                      onChange={(e) => setFormInput(e.target.value)}
                    />
                  </div>
                )}

                {modalType === 'close' && (
                  <div className="field">
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                      Resolution Summary &amp; Official Actions Taken
                    </label>
                    <textarea
                      rows="3"
                      className="form-control"
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit' }}
                      placeholder="e.g. Investigation completed, road cleared, citations issued, report resolved."
                      value={formInput}
                      onChange={(e) => setFormInput(e.target.value)}
                    />
                  </div>
                )}

                {modalType === 'reject' && (
                  <div className="field">
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                      Reason for Rejection <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <textarea
                      rows="3"
                      className="form-control"
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit' }}
                      placeholder="State reason (e.g. Duplicate submission, test entry, coordinates outside Bulacan jurisdiction)..."
                      value={formInput}
                      onChange={(e) => setFormInput(e.target.value)}
                      required
                    />
                    <div style={{ color: 'var(--ink-mute)', fontSize: '11.5px', marginTop: '6px' }}>
                      This rejection explanation will be attached to the public tracking status.
                    </div>
                  </div>
                )}

                {modalType === 'assign' && (
                  <>
                    <div className="field" style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                        Select Active Traffic Officer <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <select
                        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
                        value={selectedOfficerId}
                        onChange={(e) => setSelectedOfficerId(e.target.value)}
                        required
                      >
                        {officers.map((off) => (
                          <option key={off.id} value={off.id}>
                            {off.name} ({off.badge_number || 'No Badge'}) &bull; Active Cases: {off.active_assignments_count || 0}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                        Special Assignment Dispatch Notes
                      </label>
                      <textarea
                        rows="2"
                        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit' }}
                        placeholder="e.g. Inspect vehicle skid marks and coordinate with Bulacan Rescue."
                        value={formInput}
                        onChange={(e) => setFormInput(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="sheet__foot">
                <button type="button" className="btn btn--ghost btn--sm" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn--sm ${modalType === 'reject' ? 'btn--danger' : 'btn--dark'}`}
                  disabled={submitting}
                >
                  {submitting ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
