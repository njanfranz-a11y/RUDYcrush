import React from 'react';
import { Clock, CheckCircle2, AlertCircle, UserCheck, Shield, XCircle, ArrowRight } from 'lucide-react';

const getStatusIcon = (status) => {
  switch (status) {
    case 'submitted':
      return <Clock size={16} color="#d97706" />;
    case 'under_review':
      return <Clock size={16} color="#ca8a04" />;
    case 'verified':
      return <CheckCircle2 size={16} color="#16a34a" />;
    case 'assigned':
      return <UserCheck size={16} color="#4f46e5" />;
    case 'in_progress':
      return <Shield size={16} color="#0284c7" />;
    case 'closed':
      return <CheckCircle2 size={16} color="#475569" />;
    case 'rejected':
      return <XCircle size={16} color="#dc2626" />;
    default:
      return <AlertCircle size={16} color="#64748b" />;
  }
};

export default function StatusTimeline({ history = [] }) {
  if (!history || history.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recorded status history yet.</div>;
  }

  return (
    <div style={{ position: 'relative', paddingLeft: '24px' }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute',
        left: '11px',
        top: '8px',
        bottom: '8px',
        width: '2px',
        backgroundColor: 'var(--border-color)',
        zIndex: 0
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {history.map((item, index) => (
          <div key={item.id || index} style={{ position: 'relative', zIndex: 1 }}>
            {/* Timeline bullet dot */}
            <div style={{
              position: 'absolute',
              left: '-24px',
              top: '2px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              border: '2px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {getStatusIcon(item.to_status)}
            </div>

            {/* Event details card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {item.from_status && item.from_status !== 'none' && (
                    <>
                      <span className={`badge badge-${item.from_status}`} style={{ fontSize: '11px' }}>
                        {item.from_status.replace('_', ' ')}
                      </span>
                      <ArrowRight size={12} color="#94a3b8" />
                    </>
                  )}
                  <span className={`badge badge-${item.to_status}`} style={{ fontSize: '11px' }}>
                    {item.to_status.replace('_', ' ')}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              {item.remarks && (
                <p style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px', lineHeight: 1.5 }}>
                  {item.remarks}
                </p>
              )}

              {item.user && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Logged by: <strong>{item.user.name}</strong> ({item.user.role})
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
