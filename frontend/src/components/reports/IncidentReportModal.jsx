import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import IncidentReportForm from './IncidentReportForm';

/**
 * Dashboard reporting dialog. It reuses IncidentReportForm so the full-page
 * route and the modal always share the same validation and submission logic.
 */
export default function IncidentReportModal({ onClose, onSubmitted }) {
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  // Prevent the dashboard underneath from scrolling while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Escape belongs to the discard confirmation first, then to the form dialog.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;

      if (confirmDiscard) {
        setConfirmDiscard(false);
        return;
      }

      requestClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDiscard, requestClose]);

  const handleSubmitted = (payload) => {
    onSubmitted?.(payload);
    onClose();
  };

  return (
    <>
      <div className="modal-overlay" onClick={requestClose}>
        <div
          className="rw-incident-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="incidentReportModalTitle"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet__head rw-incident-modal__head">
            <div>
              <h3 id="incidentReportModalTitle">File an Incident Report</h3>
              <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                Province of Bulacan &bull; Official incident filing
              </p>
            </div>
            <button
              type="button"
              className="modal-close"
              onClick={requestClose}
              aria-label="Close incident report form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="rw-incident-modal__body">
            <IncidentReportForm
              embedded
              onSubmitted={handleSubmitted}
              onCancel={requestClose}
              onDirtyChange={setDirty}
            />
          </div>
        </div>
      </div>

      {confirmDiscard && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1100 }}
          onClick={(event) => {
            event.stopPropagation();
            setConfirmDiscard(false);
          }}
        >
          <div
            className="sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discardReportTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet__head">
              <h3 id="discardReportTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#d97706" />
                Discard this report?
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setConfirmDiscard(false)}
                aria-label="Keep editing report"
              >
                <X size={16} />
              </button>
            </div>
            <div className="sheet__body">
              <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.6 }}>
                You have unsaved information in this incident report. If you close it now, your entries and attached photos will be discarded.
              </p>
            </div>
            <div className="sheet__foot">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  setConfirmDiscard(false);
                  onClose();
                }}
              >
                Discard Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
