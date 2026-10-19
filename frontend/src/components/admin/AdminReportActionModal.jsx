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
 * Shared action sheet for a single report.
 *
 * Used by both the full Reports list and the Verification Queue so the
 * verify / reject / request-info / assign behaviour is defined once.
 * Admins can verify (which always dispatches an officer) or reject a report;
 * resolving/closing a case is the assigned officer's job, not the admin's, so
 * there is deliberately no close action here.
 *
 * The component owns its own form state and API call; the parent only chooses
 * which report and which action, then refreshes via onDone().
 */
export default function AdminReportActionModal({ report, action, officers = [], onClose, onDone }) {
  const [formInput, setFormInput] = useState('');
  const [officerNotes, setOfficerNotes] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reference = report.report_number || report.id;

  // Verification and (re)assignment both need an officer, so the select is
  // shared between them. Derive the effective id so we never need an effect
  // to seed state once the officers list finishes loading.
  const needsOfficer = action === 'verify' || action === 'assign';
  const effectiveOfficerId = selectedOfficerId || (officers[0]?.id ? String(officers[0].id) : '');
  const noOfficers = needsOfficer && officers.length === 0;

  const title = {
    verify: `Verify & Assign Report ${reference}`,
    reject: `Reject Report ${reference}`,
    assign: `Reassign Officer on ${reference}`,
    request_info: 'Request Additional Information',
  }[action] || 'Update Report';

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    // Mirror the server rules so the user gets an immediate message rather
    // than a rejected round trip.
    if (needsOfficer && !effectiveOfficerId) {
      setError('Please select an active Traffic Officer.');
      return;
    }
    if (action === 'reject' && !formInput.trim()) {
      setError('A rejection reason is strictly required.');
      return;
    }
    if (action === 'request_info' && !formInput.trim()) {
      setError('Please state what additional details are needed from the reporter.');
      return;
    }

    setSubmitting(true);

    try {
      if (action === 'verify') {
        await api.admin.verifyReport(report.id, {
          officer_id: effectiveOfficerId,
          official_remarks: formInput,
          assignment_notes: officerNotes,
        });
      } else if (action === 'reject') {
        await api.admin.rejectReport(report.id, { rejection_reason: formInput });
      } else if (action === 'assign') {
        await api.admin.assignOfficer(report.id, {
          officer_id: effectiveOfficerId,
          assignment_notes: officerNotes,
        });
      } else if (action === 'request_info') {
        await api.admin.requestInfo(report.id, { notes: formInput });
      }

      onDone?.();
      onClose();
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const officerField = (
    <div className="field" style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>Select Active Traffic Officer {requiredMark}</label>
      {noOfficers ? (
        <div style={{
          padding: '10px 14px',
          background: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          color: '#92400e',
          fontSize: '13px',
        }}>
          No active Traffic Officers are available. Create or activate an officer account first.
        </div>
      ) : (
        <select
          style={{ ...controlStyle, background: '#fff' }}
          value={effectiveOfficerId}
          onChange={(e) => setSelectedOfficerId(e.target.value)}
          required
        >
          {officers.map((off) => (
            <option key={off.id} value={off.id}>
              {off.name} ({off.badge_number || 'No Badge'}) • Active Cases: {off.active_assignments_count || 0}
            </option>
          ))}
        </select>
      )}
    </div>
  );

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
            {action === 'verify' && (
              <>
                {officerField}

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Official Remarks / Command Center Verification</label>
                  <textarea
                    rows="3"
                    style={controlStyle}
                    placeholder="e.g. Incident verified via Bulacan Command Center CCTV feed. No immediate road blockage."
                    value={formInput}
                    onChange={(e) => setFormInput(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label style={labelStyle}>Assignment Notes for the Officer</label>
                  <textarea
                    rows="2"
                    style={controlStyle}
                    placeholder="e.g. Prioritise lane clearance and coordinate with Bulacan Rescue."
                    value={officerNotes}
                    onChange={(e) => setOfficerNotes(e.target.value)}
                  />
                  <div style={hintStyle}>
                    Verifying hands this case to the officer for investigation and resolution.
                  </div>
                </div>
              </>
            )}

            {action === 'reject' && (
              <div className="field">
                <label style={labelStyle}>
                  Reason for Rejection {requiredMark}
                </label>
                <textarea
                  rows="3"
                  style={controlStyle}
                  placeholder="State reason (e.g. Duplicate submission, test entry, coordinates outside Bulacan jurisdiction)..."
                  value={formInput}
                  onChange={(e) => setFormInput(e.target.value)}
                  required
                />
                <div style={hintStyle}>
                  This rejection explanation will be attached to the public tracking status.
                </div>
              </div>
            )}

            {action === 'request_info' && (
              <div className="field">
                <label style={labelStyle}>
                  Details Needed From Reporter {requiredMark}
                </label>
                <textarea
                  rows="3"
                  style={controlStyle}
                  placeholder="e.g. Please attach a clearer photo of the damaged guardrail and confirm the exact lane."
                  value={formInput}
                  onChange={(e) => setFormInput(e.target.value)}
                  required
                />
                <div style={hintStyle}>
                  The reporter is notified and the report moves to “Info required”.
                </div>
              </div>
            )}

            {action === 'assign' && (
              <>
                {officerField}

                <div className="field">
                  <label style={labelStyle}>Special Assignment Dispatch Notes</label>
                  <textarea
                    rows="2"
                    style={controlStyle}
                    placeholder="e.g. Inspect vehicle skid marks and coordinate with Bulacan Rescue."
                    value={officerNotes}
                    onChange={(e) => setOfficerNotes(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="sheet__foot">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn--sm ${action === 'reject' ? 'btn--danger' : 'btn--dark'}`}
              disabled={submitting || noOfficers}
            >
              {submitting ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
