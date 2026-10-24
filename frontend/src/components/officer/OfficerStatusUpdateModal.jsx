import React, { useState } from 'react';
import { api } from '../../services/api';
import { AlertCircle, X, Send } from 'lucide-react';

// Mirrors AccidentReport::VALID_TRANSITIONS so the dropdown only offers
// transitions the backend will actually accept.
const VALID_TRANSITIONS = {
  submitted: ['under_review', 'verified', 'assigned', 'rejected'],
  under_review: ['additional_info_required', 'verified', 'assigned', 'rejected'],
  additional_info_required: ['under_review', 'submitted', 'rejected'],
  verified: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'verified', 'rejected', 'closed'],
  in_progress: ['closed', 'verified'],
  closed: [],
  rejected: [],
};

const STATUS_LABELS = {
  under_review: 'Mark Under Review',
  assigned: 'Assigned for Investigation',
  additional_info_required: 'Request More Information',
  rejected: 'Reject Report',
  in_progress: 'Investigation In Progress',
  closed: 'Closed & Road Cleared',
};

// Only these targets can be set through the officer investigation endpoint.
// Verification and rejection use their own dedicated endpoints, and
// investigation updates are only allowed once the case has been verified.
const OFFICER_ALLOWED = ['in_progress', 'closed'];
const INVESTIGABLE = ['verified', 'in_progress'];

const allowedTargets = (currentStatus) =>
  INVESTIGABLE.includes(currentStatus)
    ? (VALID_TRANSITIONS[currentStatus] || []).filter((s) => OFFICER_ALLOWED.includes(s))
    : [];

/**
 * Shared investigation status editor for the officer Reports page. Extracted
 * from OfficerDashboardPage so both screens offer the exact same action with
 * identical behaviour.
 */
export default function OfficerStatusUpdateModal({ report, onClose, onUpdated }) {
  const targets = allowedTargets(report.status);
  const [nextStatus, setNextStatus] = useState(targets[0] || 'closed');
  const [remarks, setRemarks] = useState(report.official_remarks || '');
  const [findings, setFindings] = useState(report.investigation_findings || '');
  const [actionsTaken, setActionsTaken] = useState(report.actions_taken || '');
  const [modalError, setModalError] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (nextStatus === 'closed' && (!findings.trim() || !actionsTaken.trim())) {
      setModalError('Investigation findings and actions taken are mandatory before closing an incident.');
      return;
    }

    setUpdating(true);

    try {
      await api.officer.updateStatus(report.id, {
        status: nextStatus,
        official_remarks: remarks,
        investigation_findings: findings,
        actions_taken: actionsTaken,
      });

      onUpdated();
    } catch (err) {
      setModalError(err.friendlyMessage || err.message || 'Failed to update investigation status.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '18px' }}>
            Update Investigation: {report.report_number}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {modalError && (
          <div className="alert alert-danger" style={{ margin: '14px 18px 0' }}>
            <AlertCircle size={16} /> <div>{modalError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Target Status</label>
            <select
              className="form-control"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            >
              {/* Only transitions the backend accepts for this case's status. */}
              {targets.length === 0 ? (
                <option value={report.status}>No further status changes available</option>
              ) : (
                targets.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                ))
              )}
            </select>
            {targets.length === 0 && (
              <div className="form-hint" style={{ marginTop: '6px' }}>
                This report is not open for investigation updates. Verify it first, or it may already be in a terminal state.
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Official Remarks</label>
            <textarea
              className="form-control"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Officer initial comments..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Investigation Findings {nextStatus === 'closed' && <span style={{ color: 'var(--red)' }}>*</span>}
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Causation, skid marks, road conditions..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Actions Taken {nextStatus === 'closed' && <span style={{ color: 'var(--red)' }}>*</span>}
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={actionsTaken}
              onChange={(e) => setActionsTaken(e.target.value)}
              placeholder="Vehicles towed, debris cleared, citations issued..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={updating}>
              <Send size={13} style={{ marginRight: 6 }} /> {updating ? 'Submitting...' : 'Commit Status Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}