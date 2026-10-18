import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Shield, Search } from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    api.admin.getAuditLogs({ search: search || undefined })
      .then((res) => {
        if (res.data?.success) {
          setLogs(res.data.data.data || []);
        }
      })
      .catch((err) => console.log('Audit logs error:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <section className="panel active dashboard-container">
      {/* PANEL: HEADER */}
      <div className="phead">
        <div>
          <h2 className="hd">System Audit Trail</h2>
          <p>Cryptographic &amp; tamper-evident log of case assignments, verifications, and user actions.</p>
        </div>
      </div>

      {/* SEARCH TOOLBAR */}
      <div className="filters">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '420px' }}>
          <input
            placeholder="Search action, description, or IP address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit logs"
          />
        </form>
      </div>

      {/* AUDIT LOG TABLE CARD */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-mute)' }}>
            Loading audit events...
          </div>
        ) : logs.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: '4px' }}>
              No audit records found
            </div>
            <div style={{ fontSize: '0.84rem' }}>No system events matched your current search query.</div>
          </div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Acting User</th>
                  <th>Action Type</th>
                  <th>Target Entity</th>
                  <th>Description</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="tid">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="tsub">
                        {new Date(log.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      {log.user ? (
                        <div>
                          <div className="tname">{log.user.name}</div>
                          <div className="tsub">{log.user.role}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ink-mute)', fontSize: '0.82rem' }}>System / Guest</span>
                      )}
                    </td>
                    <td>
                      <span className="status-pill st-progress">
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="tid">
                        {log.target_type ? `${log.target_type} #${log.target_id || ''}` : '—'}
                      </span>
                    </td>
                    <td style={{ maxWidth: '380px' }}>
                      <div style={{ fontSize: '0.86rem', color: 'var(--ink)' }}>
                        {log.description}
                      </div>
                    </td>
                    <td>
                      <span className="tid" style={{ fontSize: '0.76rem' }}>
                        {log.ip_address || '127.0.0.1'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <span>Showing {logs.length} logged events</span>
        </div>
      </div>
    </section>
  );
}
