import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import ReportDetailsContent from '../../components/reports/ReportDetailsContent';
import { ArrowLeft, AlertCircle } from 'lucide-react';

/**
 * Legacy full-page detail screen.
 *
 * View/Details actions now open ReportDetailsModal so the underlying list
 * keeps its filters, search, pagination and scroll position. This page is
 * retained as a direct-link fallback and reuses the exact same content.
 */
export default function ReportDetailsPage({ reportId, onBack }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = () => {
    setLoading(true);
    setError('');
    api.getReport(reportId)
      .then((res) => {
        if (res.data?.success) {
          setReport(res.data.data);
        }
      })
      .catch((err) => {
        setError(err.friendlyMessage || err.message || 'Failed to load report.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
        Loading incident details...
      </div>
    );
  }

  if (error && !report) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ padding: '14px 18px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <div>{error}</div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
            <ArrowLeft size={15} /> Return to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="panel active dashboard-container" id="panel-detail">
      <div className="detail-back-row">
        <button type="button" className="btn btn--ghost btn--sm" id="detailBack" onClick={onBack}>
          &larr; Back to reports
        </button>
      </div>
      <ReportDetailsContent report={report} onUpdated={fetchReport} />
    </section>
  );
}
