import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Search, Edit2, AlertCircle, X, CheckCircle2, Shield, User } from 'lucide-react';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [formRole, setFormRole] = useState('reporter');
  const [formBadge, setFormBadge] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    api.admin.getUsers({ role: roleFilter || undefined, search: search || undefined })
      .then((res) => {
        if (res.data?.success) {
          setUsers(res.data.data.data || []);
        }
      })
      .catch((err) => console.log('Users load error:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const openEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setFormRole(targetUser.role);
    setFormBadge(targetUser.badge_number || '');
    setFormIsActive(targetUser.is_active);
    setError('');
    setSuccess('');
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setError('');
    setSuccess('');
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.admin.updateUserRole(editingUser.id, {
        role: formRole,
        badge_number: formRole === 'officer' ? formBadge : null,
        is_active: formIsActive,
      });

      setSuccess('User updated successfully.');
      fetchUsers();
      setTimeout(closeEditModal, 1000);
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const getRolePillClass = (role) => {
    if (role === 'admin') return 'st-rejected';
    if (role === 'officer') return 'st-progress';
    return 'st-verify';
  };

  return (
    <section className="panel active dashboard-container">
      {/* PANEL: HEADER */}
      <div className="phead">
        <div>
          <h2 className="hd">Personnel &amp; Users</h2>
          <p>Directory of registered citizens, assigned traffic officers, and administrators.</p>
        </div>
      </div>

      {/* FILTERS & SEARCH ROW */}
      <div className="filters">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
          <input
            placeholder="Search by name, email, or badge number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </form>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="">All Roles</option>
          <option value="admin">Administrators</option>
          <option value="officer">Traffic Officers</option>
          <option value="reporter">Citizen Residents</option>
        </select>
      </div>

      {/* USER TABLE CARD */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-mute)' }}>
            Loading personnel directory...
          </div>
        ) : users.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: '4px' }}>
              No users found
            </div>
            <div style={{ fontSize: '0.84rem' }}>No accounts matched your search or role filter criteria.</div>
          </div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Contact Info</th>
                  <th>Role</th>
                  <th>Badge Number</th>
                  <th>Account Status</th>
                  <th>Activity History</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="tname">
                        {u.name} {u.id === currentUser?.id && <span style={{ color: 'var(--amber-deep)', fontSize: '11px', fontWeight: 600 }}>(You)</span>}
                      </div>
                      <div className="tsub">ID: RW-USR-{u.id}</div>
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <div className="tsub">{u.phone || 'No contact specified'}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${getRolePillClass(u.role)}`}>
                        {u.role === 'reporter' ? 'Citizen' : u.role}
                      </span>
                    </td>
                    <td>
                      {u.badge_number ? (
                        <span className="tid">{u.badge_number}</span>
                      ) : (
                        <span style={{ color: 'var(--ink-mute)', fontSize: '0.82rem' }}>&mdash;</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${u.is_active ? 'st-resolved' : 'st-off'}`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                        <b>{u.accident_reports_count || 0}</b> filed &bull; <b>{u.officer_assignments_count || 0}</b> assigned
                      </div>
                    </td>
                    <td>
                      <div className="rowactions">
                        <button
                          type="button"
                          className="case-view-btn"
                          onClick={() => openEditModal(u)}
                        >
                          <Edit2 size={12} /> Edit Role
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <span>Showing {users.length} accounts</span>
        </div>
      </div>

      {/* EDIT ROLE MODAL */}
      {editingUser && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet__head">
              <div>
                <h3>Edit Permissions: {editingUser.name}</h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                  {editingUser.email} &bull; Currently {editingUser.role}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeEditModal} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> <div>{error}</div>
              </div>
            )}

            {success && (
              <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> <div>{success}</div>
              </div>
            )}

            <form onSubmit={handleUpdateRole}>
              <div className="sheet__body">
                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                    Assigned System Role
                  </label>
                  <select
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                  >
                    <option value="reporter">Citizen Resident / Reporter</option>
                    <option value="officer">Traffic Investigator / Field Officer</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>

                {formRole === 'officer' && (
                  <div className="field" style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '6px' }}>
                      Official Badge Number
                    </label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13.5px' }}
                      placeholder="e.g. PO3-8821"
                      value={formBadge}
                      onChange={(e) => setFormBadge(e.target.value)}
                    />
                  </div>
                )}

                <div className="field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', color: 'var(--ink)' }}>
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--navy-800)' }}
                    />
                    <span>Account Active (permits login &amp; case dispatch)</span>
                  </label>
                </div>
              </div>

              <div className="sheet__foot">
                <button type="button" className="btn btn--ghost btn--sm" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--dark btn--sm" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
