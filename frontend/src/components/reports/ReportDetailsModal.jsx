import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import ReportDetailsContent from './ReportDetailsContent';
import AdminReportActionModal from '../admin/AdminReportActionModal';
import OfficerVerificationModal from '../officer/OfficerVerificationModal';
import OfficerStatusUpdateModal from '../officer/OfficerStatusUpdateModal';
import { AlertCircle, CheckCircle2, Shield, UserPlus, X, XCircle } from 'lucide-react';

/**
 * Read-only report detail modal used by every View/Details action.
 *
 * It fetches the selected report by id (never reusing a previous report's
 * data), exposes only the actions the signed-in role is allowed to perform,
 * and leaves the page underneath untouched so filters, search, pagination and
 * scroll position survive closing.
 */
export default function ReportDetailsModal({ reportId, onClose }) {
  const { user, isAdmin, isOfficer } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const [officers, setOfficers] = useState([]);
  const [actionModal, setActionModal] = useState(null); // 'assign' | 'verify' | 'reject' | 'status'

  useEffect(() => {
    let cancelled = false;

    // Clear immediately so a newly selected row can never show the previous
    // report's fields or photos while its own request is in flight.
    setReport(null);
    setError('');
    setDirty(false);
    setActionModal(null);
    setLoading(true);

    api.getReport(reportId)
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setReport(res.data.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.friendlyMessage || err.message || 'Failed to load report details.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  // Admins need the officer roster for the assign/reassign action. Officers
  // and residents never request it.
  useEffect(() => {
    if (!isAdmin) return undefined;

    let cancelled = false;
    api.admin
      .getOfficers()
      .then((res) => {
        if (!cancelled && res.data?.success) setOfficers(res.data.data || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Escape closes the top-level report modal. When a nested action sheet or
  // photo lightbox is open, leave that overlay in charge.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;

      // A nested action sheet or photo lightbox is open: Escape belongs to
      // that layer, not to the report dialog underneath.
      if (document.querySelectorAll('.modal-overlay').length > 1) {
        if (actionModal) setActionModal(null);
        return;
      }

      onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, actionModal]);

  // Prevent the list underneath from scrolling while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const refreshReport = () => {
    api.getReport(reportId)
      .then((res) => {
        if (res.data?.success) setReport(res.data.data);
      })
      .catch(() => {});
  };

  const handleBackdrop = () => {
    if (!dirty) onClose();
  };

  const canAdminAssign = isAdmin && report && !['closed', 'rejected'].includes(report.status);
  const isMyAssignedCase = isOfficer && report && report.assigned_officer_id === user?.id;
  const canOfficerVerify = isMyAssignedCase && report.status === 'assigned';
  const canOfficerInvestigate = isMyAssignedCase && ['verified', 'in_progress'].includes(report.status);

  return (
    <>
      <div className="modal-overlay" onClick={handleBackdrop}>
        <div
          className="rw-report-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={report ? `Report ${report.report_number || report.id} details` : 'Report details'}
        >
        <div className="sheet__head rw-report-modal__head">
          <div>
            <h3>Incident Details</h3>
            <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
              {report ? (report.report_number || `RW-${report.id}`) : 'Loading report...'}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close details">
            <X size={18} />
          </button>
        </div>

        <div className="rw-report-modal__body">
          {/* Role-specific actions, using the same endpoints and permissions
              as the list screens. */}
          {(canAdminAssign || canOfficerVerify || canOfficerInvestigate) && (
            <div className="rw-report-modal__actions">
              {canAdminAssign && (
                <button
                  type="button"
                  className="btn btn--dark btn--sm"
                  onClick={() => setActionModal('assign')}
                >
                  <UserPlus size={14} style={{ marginRight: 6 }} />
                  {report.assigned_officer ? 'Reassign Officer' : 'Assign Officer'}
                </button>
              )}

              {canOfficerVerify && (
                <>
                  <button
                    type="button"
                    className="btn btn--dark btn--sm"
                    onClick={() => setActionModal('verify')}
                  >
                    <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Verify Report
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setActionModal('reject')}
                  >
                    <XCircle size={14} style={{ marginRight: 6 }} /> Reject Report
                  </button>
                </>
              )}

              {canOfficerInvestigate && (
                <button
                  type="button"
                  className="btn btn--dark btn--sm"
                  onClick={() => setActionModal('status')}
                >
                  <Shield size={14} style={{ marginRight: 6 }} /> Update Investigation
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
              Loading incident details...
            </div>
          ) : error || !report ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ padding: '14px 18px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                <AlertCircle size={20} />
                <div>{error || 'The selected report could not be loaded.'}</div>
              </div>
            </div>
          ) : (
            <ReportDetailsContent
              report={report}
              onUpdated={refreshReport}
              onDirtyChange={setDirty}
            />
          )}
        </div>
      </div>
    </div>

      {/* The action sheets render above the detail dialog. */}
      {actionModal === 'assign' && report && (
        <AdminReportActionModal
          report={report}
          action="assign"
          officers={officers}
          onClose={() => setActionModal(null)}
          onDone={refreshReport}
        />
      )}

      {(actionModal === 'verify' || actionModal === 'reject') && report && (
        <OfficerVerificationModal
          report={report}
          action={actionModal}
          onClose={() => setActionModal(null)}
          onDone={refreshReport}
        />
      )}

      {actionModal === 'status' && report && (
        <OfficerStatusUpdateModal
          report={report}
          onClose={() => setActionModal(null)}
          onUpdated={() => {
            refreshReport();
            setActionModal(null);
          }}
        />
      )}
    </>
  );
}
