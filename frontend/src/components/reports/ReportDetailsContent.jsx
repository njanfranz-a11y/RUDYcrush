import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import LeafletMapPicker from '../map/LeafletMapPicker';
import StatusTimeline from './StatusTimeline';
import EvidenceGallery from './EvidenceGallery';
import { Send } from 'lucide-react';

export function getStatusPillClass(st) {
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
}

export function getStatusLabel(st) {
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
}

/**
 * The report detail body shared by the full-page fallback and the modal.
 *
 * It owns only the citizen supplement form; report-level actions for admins
 * and officers live in the modal wrapper so the same content can be reused
 * from the legacy page without granting extra permissions.
 */
export default function ReportDetailsContent({ report, onUpdated, onDirtyChange }) {
  const { user } = useAuth();
  const [supplementNotes, setSupplementNotes] = useState('');
  const [supplementPhotos, setSupplementPhotos] = useState([]);
  const [supplementing, setSupplementing] = useState(false);
  const [supplementSuccess, setSupplementSuccess] = useState('');
  const [supplementError, setSupplementError] = useState('');

  const isDirty = supplementNotes.trim().length > 0 || supplementPhotos.length > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSupplementSubmit = async (e) => {
    e.preventDefault();
    setSupplementSuccess('');
    setSupplementError('');

    if (!supplementNotes.trim() && supplementPhotos.length === 0) {
      setSupplementError('Please enter supplementary details or select photos.');
      return;
    }

    setSupplementing(true);

    try {
      const formData = new FormData();
      if (supplementNotes) {
        formData.append('additional_details', supplementNotes);
      }
      supplementPhotos.forEach((file) => {
        formData.append('photos[]', file);
      });

      const res = await api.supplementReport(report.id, formData);
      if (res.data?.success) {
        setSupplementSuccess('Additional details and evidence successfully submitted!');
        setSupplementNotes('');
        setSupplementPhotos([]);
        onUpdated?.();
      }
    } catch (err) {
      setSupplementError(err.friendlyMessage || err.message || 'Failed to supplement report.');
    } finally {
      setSupplementing(false);
    }
  };

  const isOwner = user && report.user_id === user.id;
  const canSupplement = isOwner && ['submitted', 'under_review', 'additional_info_required'].includes(report.status);

  return (
    <div id="caseDetailContent">
      {/* CASE DETAIL HEADER CARD */}
      <div className="case-detail-head">
        <div>
          <h2>{report.report_number || `RW-${report.id}`}</h2>
          <p>
            {report.accident_date} at {report.accident_time} &bull; {report.location_address}
          </p>
        </div>
        <div className="case-head-right">
          <small>Incident category</small>
          <b style={{ color: 'var(--ink)', fontSize: '15px' }}>{report.accident_type || 'Road Incident'}</b>
          <span className={`status-pill ${getStatusPillClass(report.status)}`}>
            {getStatusLabel(report.status)}
          </span>
        </div>
      </div>

      {/* 2-COLUMN DETAIL GRID */}
      <div className="case-detail-grid">
        {/* LEFT COLUMN: PARTICULARS, MAP, EVIDENCE */}
        <div>
          <article className="detail-card">
            <h3>Incident particulars</h3>
            <div className="detail-kvs">
              <div>
                <small>Vehicles involved</small>
                <b>{report.vehicles_involved || 1}</b>
              </div>
              <div>
                <small>Injury severity</small>
                <b style={{ textTransform: 'capitalize' }}>{report.injury_severity || 'Moderate'}</b>
              </div>
            </div>
            <h4>Incident description</h4>
            <p style={{ whiteSpace: 'pre-line' }}>{report.description || 'No description provided.'}</p>
            <small style={{ marginTop: '12px', display: 'block' }}>
              Reported by {report.reporter_name || 'Anonymous resident'} &bull; Contact: {report.reporter_contact || 'None on record'}
            </small>

            {report.rejection_reason && (
              <div style={{ marginTop: '16px', padding: '12px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
                <strong>Rejection Notice:</strong> {report.rejection_reason}
              </div>
            )}

            {report.additional_info_notes && report.status === 'additional_info_required' && (
              <div style={{ marginTop: '16px', padding: '12px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '13px' }}>
                <strong>Reviewer Notice:</strong> {report.additional_info_notes}
              </div>
            )}
          </article>

          {/* LOCATION MAP */}
          {report.latitude && report.longitude && (
            <article className="detail-card">
              <h3>Incident location map</h3>
              <p style={{ marginBottom: '14px' }}>
                {report.location_address} {report.barangay ? `&bull; Barangay ${report.barangay}` : ''}
              </p>
              <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <LeafletMapPicker
                  latitude={report.latitude}
                  longitude={report.longitude}
                  interactive={false}
                  height="280px"
                />
              </div>
            </article>
          )}

          {/* EVIDENCE PHOTOS */}
          <article className="detail-card">
            <h3>Photographic evidence ({report.photos?.length || 0})</h3>
            <EvidenceGallery photos={report.photos || []} />
          </article>

          {/* SUPPLEMENT FORM (CITIZEN ONLY) */}
          {canSupplement && (
            <article className="detail-card" style={{ borderColor: 'var(--amber)' }}>
              <h3>Supplement incident record</h3>
              <p style={{ marginBottom: '14px' }}>
                Provide additional details, driver contacts, or extra evidence photos while this report is under verification.
              </p>

              {supplementSuccess && (
                <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px' }}>
                  {supplementSuccess}
                </div>
              )}

              {supplementError && (
                <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
                  {supplementError}
                </div>
              )}

              <form onSubmit={handleSupplementSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                    Additional notes
                  </label>
                  <textarea
                    rows="3"
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit' }}
                    placeholder="Clarify location landmarks, vehicle plates, or driver statements..."
                    value={supplementNotes}
                    onChange={(e) => setSupplementNotes(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                    Attach additional photos (Max 5MB)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setSupplementPhotos(Array.from(e.target.files))}
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn--dark btn--sm"
                  disabled={supplementing}
                >
                  <Send size={13} /> {supplementing ? 'Uploading...' : 'Submit supplemental details'}
                </button>
              </form>
            </article>
          )}
        </div>

        {/* RIGHT COLUMN: VERIFICATION & DISPATCH, AUDIT PROGRESSION */}
        <div>
          <article className="detail-card">
            <h3>Official verification &amp; dispatch</h3>
            <p>
              <b>{report.verified_at ? 'Officially verified' : 'Awaiting verification'}</b><br />
              <small>
                {report.verified_at
                  ? `Verified on ${new Date(report.verified_at).toLocaleString()} by Bulacan Command Desk`
                  : 'No verification recorded yet by traffic dispatch.'}
              </small>
            </p>

            <p style={{ marginTop: '14px' }}>
              <b>
                Assigned officer: {report.assigned_officer ? `${report.assigned_officer.name} (${report.assigned_officer.badge_number || 'Badge PO'})` : 'Unassigned'}
              </b>
            </p>

            <div className="remarks">
              <b>Official remarks</b>
              <p>{report.official_remarks || 'Pending field inspection.'}</p>
            </div>

            {report.investigation_findings && (
              <div className="remarks" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', marginTop: '12px' }}>
                <b style={{ color: '#166534' }}>Investigation findings</b>
                <p style={{ color: '#14532d' }}>{report.investigation_findings}</p>
              </div>
            )}

            {report.actions_taken && (
              <div className="remarks" style={{ marginTop: '12px' }}>
                <b>Actions taken</b>
                <p>{report.actions_taken}</p>
              </div>
            )}
          </article>

          {/* STATUS PROGRESSION AUDIT */}
          <article className="detail-card">
            <h3>Status progression audit</h3>
            <StatusTimeline history={report.status_history || []} />
          </article>
        </div>
      </div>
    </div>
  );
}
