import React, { useState } from 'react';
import { api } from '../../services/api';
import { AlertCircle, X } from 'lucide-react';

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 650,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft)',
  marginBottom: '6px',
};

const controlStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid var(--border)',
  borderRadius: '8px',
  fontSize: '13.5px',
  fontFamily: 'inherit',
};

const hintStyle = { color: 'var(--ink-mute)', fontSize: '11.5px', marginTop: '6px' };

const requiredMark = <span style={{ color: 'var(--red)' }}>*</span>;

/**
 * Verification decision sheet for the assigned Traffic Officer.
 *
 * Mirrors the admin action sheet visually, but the only actions are the
 * officer's own verify / reject decision on a report already dispatched to
 * them. The backend enforces the same ownership rule, so this component is
 * convenience rather than the security boundary.
 */
export default function OfficerVerificationModal({ report, action, onClose, onDone }) {
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reference = report.report_number || report.id;
  const isReject = action === 'reject';

  const title = isReject
    ? `Reject Report ${reference}`
    : `Verify Report ${reference}`;

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (isReject && rejectionReason.trim().length < 10) {
      setError('Please provide a rejection reason of at least 10 characters.');
      return;
    }

    setSubmitting(true);

    try {
      if (isReject) {
        await api.officer.rejectReport(report.id, {
          rejection_reason: rejectionReason.trim(),
        });
      } else {
        await api.officer.verifyReport(report.id, {
          official_remarks: remarks.trim(),
        });
      }

      onDone?.();
      onClose();
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet__head">
          <div>
            <h3>{title}</h3>
            <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
              {report.location_address || 'Bulacan incident verification'}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && (
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
            gap: '8px',
          }}>
            <AlertCircle size={16} /> <div>{error}</div>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="sheet__body">
            {isReject ? (
              <div className="field">
                <label style={labelStyle}>
                  Reason for Rejection {requiredMark}
                </label>
                <textarea
                  rows="3"
                  style={controlStyle}
                  placeholder="State the reason (e.g. duplicate submission, false location, not a road incident)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
                <div style={hintStyle}>
                  This explanation is recorded in the report history and shown to the reporter.
                </div>
              </div>
            ) : (
              <div className="field">
                <label style={labelStyle}>Verification Remarks</label>
                <textarea
                  rows="3"
                  style={controlStyle}
                  placeholder="e.g. Confirmed through field validation and Command Center records."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <div style={hintStyle}>
                  Verifying marks this case as legitimate. You can record investigation findings and
                  update the status afterwards; the report stays assigned to you.
                </div>
              </div>
            )}
          </div>

          <div className="sheet__foot">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn--sm ${isReject ? 'btn--danger' : 'btn--dark'}`}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : (isReject ? 'Reject Report' : 'Verify Report')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
