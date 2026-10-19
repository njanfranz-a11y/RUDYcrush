import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  X,
  Send,
  FileText
} from 'lucide-react';

export default function OfficerDashboardPage({ onSelectReport, onNavigate }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Investigation Update Modal
  const [activeReport, setActiveReport] = useState(null);
  const [nextStatus, setNextStatus] = useState('in_progress');
  const [remarks, setRemarks] = useState('');
  const [findings, setFindings] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [modalError, setModalError] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchOfficerData = () => {
    setLoading(true);
    Promise.all([
      api.officer.getStats(),
      api.officer.getAssignedReports(),
    ])
      .then(([statsRes, reportsRes]) => {
        if (statsRes.data?.success) setStats(statsRes.data.data);
        if (reportsRes.data?.success) setReports(reportsRes.data.data.data || []);
      })
      .catch((err) => console.log('Officer data fetch error:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOfficerData();
    const interval = setInterval(() => {
      Promise.all([
        api.officer.getStats(),
        api.officer.getAssignedReports(),
      ]).then(([statsRes, reportsRes]) => {
        if (statsRes.data?.success) setStats(statsRes.data.data);
        if (reportsRes.data?.success) setReports(reportsRes.data.data.data || []);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const openStatusModal = (report) => {
    setActiveReport(report);
    setNextStatus(report.status === 'assigned' ? 'in_progress' : 'closed');
    setRemarks(report.official_remarks || '');
    setFindings(report.investigation_findings || '');
    setActionsTaken(report.actions_taken || '');
    setModalError('');
  };

  const closeStatusModal = () => {
    setActiveReport(null);
    setModalError('');
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (nextStatus === 'closed' && (!findings.trim() || !actionsTaken.trim())) {
      setModalError('Investigation findings and actions taken are mandatory before closing an incident.');
      return;
    }

    setUpdating(true);

    try {
      await api.officer.updateStatus(activeReport.id, {
        status: nextStatus,
        official_remarks: remarks,
        investigation_findings: findings,
        actions_taken: actionsTaken,
      });

      closeStatusModal();
      fetchOfficerData();
    } catch (err) {
      setModalError(err.friendlyMessage || err.message || 'Failed to update investigation status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
        Loading officer assignment queue...
      </div>
    );
  }

  const counts = stats?.counts || {};

  const getStatusPillClass = (status) => {
    switch (status) {
      case 'assigned':
      case 'pending':
        return 'st-pending';
      case 'in_progress':
      case 'investigating':
        return 'st-progress';
      case 'closed':
      case 'resolved':
        return 'st-resolved';
      case 'rejected':
        return 'st-rejected';
      default:
        return 'st-verify';
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="phead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 className="hd" style={{ fontSize: '29px', fontWeight: 700, margin: '0 0 6px', color: 'var(--ink)' }}>Officer Command Desk</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px', margin: 0 }}>
            Traffic Investigation Unit &bull; Logged in as <strong>{user?.name}</strong> (Badge: <strong>{user?.badge_number || 'PO-Official'}</strong>)
          </p>
        </div>

        <div className="actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onNavigate('map')}
          >
            <MapPin size={14} style={{ marginRight: 6, color: 'var(--red)' }} /> View incident map
          </button>
          <button
            className="btn btn--dark btn--sm"
            onClick={() => onNavigate('officer-reports')}
          >
            <FileText size={14} style={{ marginRight: 6 }} /> Manage all reports
          </button>
        </div>
      </div>

      {/* 3 KPI Counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div className="kpi-stat-card accent-blue">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Clock size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.assigned || 0}</div>
            <div className="kpi-stat-lbl">Assigned Awaiting Action</div>
          </div>
        </div>

        <div className="kpi-stat-card accent-purple">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <Shield size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.in_progress || 0}</div>
            <div className="kpi-stat-lbl">Active In-Progress Cases</div>
          </div>
        </div>

        <div className="kpi-stat-card accent-green">
          <div className="kpi-stat-icon-wrapper" style={{ background: '#dcfce7', color: '#15803d' }}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="kpi-stat-val">{counts.closed || 0}</div>
            <div className="kpi-stat-lbl">Cases Closed &amp; Cleared</div>
          </div>
        </div>
      </div>

      {/* Reference Assigned Reports Table (.card.officer-cases) */}
      <div className="card officer-cases" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3>Assigned cases</h3>
            <p>Incidents assigned to you for roadside investigation and clearance</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="status-pill st-progress">{reports.length} cases</span>
            <button
              className="officer-update"
              onClick={() => onNavigate('officer-reports')}
            >
              View all reports
            </button>
          </div>
        </div>

        {reports.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            No incident reports are currently assigned to your badge.
          </div>
        ) : (
          <div className="tablewrap" style={{ overflowX: 'auto' }}>
            <table className="officer-case-table">
              <thead>
                <tr>
                  <th>Report #</th>
                  <th>Date &amp; time</th>
                  <th>Location</th>
                  <th>Collision type</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="tid">
                      <b>{report.report_number}</b>
                    </td>
                    <td>
                      {report.accident_date}<br />
                      <small>{report.accident_time || 'Recorded'}</small>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {report.location_address}
                      </div>
                      <small>Reporter: {report.reporter_name} ({report.reporter_contact || 'None'})</small>
                    </td>
                    <td>
                      <div>{report.accident_type}</div>
                      <small>Vehicles: {report.vehicles_involved || 1}</small>
                    </td>
                    <td>
                      <span className={`status-pill ${getStatusPillClass(report.status)}`}>
                        {report.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="rowactions">
                        <button
                          className="officer-detail"
                          onClick={() => onSelectReport(report.id)}
                        >
                          Details
                        </button>

                        {report.status !== 'closed' && (
                          <button
                            className="officer-update"
                            onClick={() => openStatusModal(report)}
                          >
                            Update status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Investigation Status Modal */}
      {activeReport && (
        <div className="modal-overlay" onClick={closeStatusModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>
                Update Investigation: {activeReport.report_number}
              </h3>
              <button className="modal-close" onClick={closeStatusModal}><X size={18} /></button>
            </div>

            {modalError && (
              <div className="alert alert-danger" style={{ margin: '14px 18px 0' }}>
                <AlertCircle size={16} /> <div>{modalError}</div>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Target Status</label>
                <select
                  className="form-control"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                >
                  <option value="in_progress">Investigation In Progress</option>
                  <option value="closed">Closed &amp; Road Cleared</option>
                </select>
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
                <button type="button" className="btn btn--ghost btn--sm" onClick={closeStatusModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={updating}>
                  <Send size={13} style={{ marginRight: 6 }} /> {updating ? 'Submitting...' : 'Commit Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
