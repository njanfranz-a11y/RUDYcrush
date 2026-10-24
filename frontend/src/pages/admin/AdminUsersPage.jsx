import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PhoneInput from '../../components/common/PhoneInput';
import { isValidPhoneNumber, PHONE_ERROR_MESSAGE, normalizePhoneDigits } from '../../services/phone';
import {
  Edit2,
  AlertCircle,
  X,
  CheckCircle2,
  Shield,
  User,
  Eye,
  RefreshCw,
  Power,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  UserPlus,
  EyeOff
} from 'lucide-react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const roleLabel = (role) => (role === 'reporter' ? 'Citizen' : role);

const statusMessageClass = (message) =>
  /could not|failed|already assigned|inactive|cannot/i.test(message)
    ? { background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626' }
    : { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' };

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formRole, setFormRole] = useState('reporter');
  const [formBadge, setFormBadge] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // View Modal State
  const [viewingUser, setViewingUser] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

  // Status Toggle State
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Create Officer Modal State
  const [creatingOfficer, setCreatingOfficer] = useState(false);
  const [officerForm, setOfficerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    badge_number: '',
    password: '',
    password_confirmation: '',
  });
  const [officerFieldErrors, setOfficerFieldErrors] = useState({});
  const [officerError, setOfficerError] = useState('');
  const [officerSuccess, setOfficerSuccess] = useState('');
  const [officerSaving, setOfficerSaving] = useState(false);
  const [showOfficerPassword, setShowOfficerPassword] = useState(false);
  const [showOfficerPasswordConfirmation, setShowOfficerPasswordConfirmation] = useState(false);

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

  // ---- View account details ------------------------------------------------
  const openViewModal = async (targetUser) => {
    setViewingUser(targetUser);
    setViewDetail(null);
    setViewError('');
    setViewLoading(true);

    try {
      const res = await api.admin.getUser(targetUser.id);
      if (res.data?.success) {
        setViewDetail(res.data.data);
      }
    } catch (err) {
      setViewError(err.friendlyMessage || err.message || 'Failed to load account details.');
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewModal = () => {
    setViewingUser(null);
    setViewDetail(null);
    setViewError('');
  };

  // Escape closes the account-details modal, matching the report details modal.
  useEffect(() => {
    if (!viewingUser) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setViewingUser(null);
      setViewDetail(null);
      setViewError('');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewingUser]);

  // ---- Edit account --------------------------------------------------------
  const openEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setFormName(targetUser.name || '');
    setFormEmail(targetUser.email || '');
    setFormPhone(normalizePhoneDigits(targetUser.phone || ''));
    setFormAddress(targetUser.address || '');
    setFormRole(targetUser.role);
    setFormBadge(targetUser.badge_number || '');
    setFieldErrors({});
    setError('');
    setSuccess('');
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setFieldErrors({});
    setError('');
    setSuccess('');
  };

  const validateEditForm = () => {
    const errors = {};

    if (!formName.trim()) {
      errors.name = 'Full name is required.';
    } else if (formName.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }

    const email = formEmail.trim();
    if (!email) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Enter a valid email address.';
    }

    const phone = formPhone.trim();
    if (phone && !isValidPhoneNumber(phone)) {
      errors.phone = PHONE_ERROR_MESSAGE;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateEditForm()) return;

    setSaving(true);

    try {
      const res = await api.admin.updateUser(editingUser.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || null,
        address: formAddress.trim() || null,
        role: formRole,
        badge_number: formRole === 'officer' ? formBadge.trim() || null : null,
      });

      setSuccess(res.data?.message || 'Account updated successfully.');
      fetchUsers();
      setTimeout(closeEditModal, 1200);
    } catch (err) {
      // Surface Laravel's field-level validation messages on the inputs.
      if (err.fieldErrors) {
        const mapped = {};
        Object.entries(err.fieldErrors).forEach(([name, messages]) => {
          mapped[name] = Array.isArray(messages) ? messages[0] : messages;
        });
        setFieldErrors(mapped);
      }
      setError(err.friendlyMessage || err.message || 'Failed to update account.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Create officer ------------------------------------------------------
  const openCreateOfficer = () => {
    setOfficerForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      badge_number: '',
      password: '',
      password_confirmation: '',
    });
    setOfficerFieldErrors({});
    setOfficerError('');
    setOfficerSuccess('');
    setShowOfficerPassword(false);
    setShowOfficerPasswordConfirmation(false);
    setCreatingOfficer(true);
  };

  const closeCreateOfficer = () => {
    setCreatingOfficer(false);
    setOfficerFieldErrors({});
    setOfficerError('');
    setOfficerSuccess('');
  };

  const handleOfficerChange = (e) => {
    const { name, value } = e.target;
    setOfficerForm(prev => ({ ...prev, [name]: value }));
    setOfficerFieldErrors(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const validateOfficerForm = () => {
    const errors = {};

    if (!officerForm.name.trim()) {
      errors.name = 'Full name is required.';
    } else if (officerForm.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }

    const email = officerForm.email.trim();
    if (!email) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Enter a valid email address.';
    }

    const phone = officerForm.phone.trim();
    if (phone && !isValidPhoneNumber(phone)) {
      errors.phone = PHONE_ERROR_MESSAGE;
    }

    if (!officerForm.badge_number.trim()) {
      errors.badge_number = 'Badge number is required.';
    }

    const password = officerForm.password;
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'Password must include both letters and numbers.';
    }

    if (!officerForm.password_confirmation) {
      errors.password_confirmation = 'Please confirm the password.';
    } else if (officerForm.password !== officerForm.password_confirmation) {
      errors.password_confirmation = 'Passwords do not match.';
    }

    setOfficerFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    setOfficerError('');
    setOfficerSuccess('');

    if (!validateOfficerForm()) return;

    setOfficerSaving(true);

    try {
      const res = await api.admin.createOfficer({
        name: officerForm.name.trim(),
        email: officerForm.email.trim(),
        phone: officerForm.phone.trim() || null,
        address: officerForm.address.trim() || null,
        badge_number: officerForm.badge_number.trim(),
        password: officerForm.password,
        password_confirmation: officerForm.password_confirmation,
      });

      setOfficerSuccess(res.data?.message || 'Traffic officer account created successfully.');
      setRoleFilter('officer');
      fetchUsers();
      setTimeout(closeCreateOfficer, 1500);
    } catch (err) {
      if (err.fieldErrors) {
        const mapped = {};
        Object.entries(err.fieldErrors).forEach(([name, messages]) => {
          mapped[name] = Array.isArray(messages) ? messages[0] : messages;
        });
        setOfficerFieldErrors(mapped);
      }
      setOfficerError(err.friendlyMessage || err.message || 'Failed to create the officer account.');
    } finally {
      setOfficerSaving(false);
    }
  };

  // ---- Status toggle -------------------------------------------------------
  const requestStatusChange = (targetUser) => {
    setStatusMessage(null);
    setStatusTarget(targetUser);
  };

  const cancelStatusChange = () => {
    setStatusTarget(null);
    setStatusMessage(null);
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;

    const target = statusTarget;
    const nextIsActive = !target.is_active;

    setStatusBusy(true);

    try {
      const res = await api.admin.updateUserStatus(target.id, { is_active: nextIsActive });

      setStatusMessage({
        type: res.data?.success ? 'success' : 'error',
        text: res.data?.message || (nextIsActive ? 'Account activated.' : 'Account deactivated.'),
      });

      setStatusTarget(null);
      fetchUsers();

      if (viewingUser?.id === target.id) {
        setViewingUser(prev => (prev ? { ...prev, is_active: nextIsActive } : prev));
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.friendlyMessage || err.message || 'Failed to update account status.',
      });
    } finally {
      setStatusBusy(false);
    }
  };

  const getRolePillClass = (role) => {
    if (role === 'admin') return 'st-rejected';
    if (role === 'officer') return 'st-progress';
    return 'st-verify';
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13.5px',
    background: '#fff',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 650,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-soft)',
    marginBottom: '6px',
  };

  const renderFieldError = (name, errors = fieldErrors) =>
    errors[name] ? (
      <span className="form-error">{errors[name]}</span>
    ) : null;

  return (
    <section className="panel active dashboard-container">
      {/* PANEL: HEADER */}
      <div className="phead">
        <div>
          <h2 className="hd">Personnel &amp; Users</h2>
          <p>Directory of registered citizens, assigned traffic officers, and administrators.</p>
        </div>

        <button className="btn btn--dark btn--sm" onClick={openCreateOfficer}>
          <UserPlus size={14} style={{ marginRight: 6 }} /> Add Traffic Officer
        </button>
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

      {/* STATUS TOGGLE FEEDBACK */}
      {statusMessage && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', ...statusMessageClass(statusMessage.text) }}>
          {statusMessage.type === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          <div>{statusMessage.text}</div>
        </div>
      )}

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
                        {roleLabel(u.role)}
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
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                        <b>{u.accident_reports_count || 0}</b> filed &bull; <b>{u.officer_assignments_count || 0}</b> assigned
                      </div>
                    </td>
                    <td>
                      <div className="rowactions" style={{ justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="case-view-btn"
                          onClick={() => openViewModal(u)}
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          type="button"
                          className="case-view-btn"
                          onClick={() => openEditModal(u)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          className="case-view-btn"
                          onClick={() => requestStatusChange(u)}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? 'You cannot change your own account status' : (u.is_active ? 'Deactivate this account' : 'Activate this account')}
                          style={u.id === currentUser?.id ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                        >
                          <Power size={12} /> {u.is_active ? 'Deactivate' : 'Activate'}
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

      {/* CREATE OFFICER MODAL */}
      {creatingOfficer && (
        <div className="modal-overlay" onClick={closeCreateOfficer}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create traffic officer">
            <div className="sheet__head">
              <div>
                <h3>Add Traffic Officer</h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                  Creates a login for the Traffic Officer module. The account is active immediately.
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeCreateOfficer} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {officerError && (
              <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> <div>{officerError}</div>
              </div>
            )}

            {officerSuccess && (
              <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> <div>{officerSuccess}</div>
              </div>
            )}

            <form onSubmit={handleCreateOfficer} noValidate>
              <div className="sheet__body">
                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="officer-name">Full Name <span className="required">*</span></label>
                  <input
                    id="officer-name"
                    name="name"
                    type="text"
                    style={{ ...inputStyle, borderColor: officerFieldErrors.name ? 'var(--danger)' : 'var(--border)' }}
                    placeholder="e.g. Officer Marco Santos"
                    value={officerForm.name}
                    onChange={handleOfficerChange}
                  />
                  {renderFieldError('name', officerFieldErrors)}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="officer-email">Email Address <span className="required">*</span></label>
                  <input
                    id="officer-email"
                    name="email"
                    type="email"
                    style={{ ...inputStyle, borderColor: officerFieldErrors.email ? 'var(--danger)' : 'var(--border)' }}
                    placeholder="e.g. officer.santos@traffic.gov"
                    value={officerForm.email}
                    onChange={handleOfficerChange}
                  />
                  {renderFieldError('email', officerFieldErrors)}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="officer-phone">Mobile Number</label>
                  <PhoneInput
                    id="officer-phone"
                    name="phone"
                    style={{ ...inputStyle, borderColor: officerFieldErrors.phone ? 'var(--danger)' : 'var(--border)' }}
                    placeholder="09171234567"
                    value={officerForm.phone}
                    onChange={handleOfficerChange}
                  />
                  {renderFieldError('phone', officerFieldErrors)}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="officer-address">Address</label>
                  <input
                    id="officer-address"
                    name="address"
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. 123 Rizal St, Brgy. Catmon, Malolos, Bulacan"
                    value={officerForm.address}
                    onChange={handleOfficerChange}
                  />
                  {renderFieldError('address', officerFieldErrors)}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="officer-badge">Official Badge Number <span className="required">*</span></label>
                  <input
                    id="officer-badge"
                    name="badge_number"
                    type="text"
                    style={{ ...inputStyle, borderColor: officerFieldErrors.badge_number ? 'var(--danger)' : 'var(--border)' }}
                    placeholder="e.g. PO3-8821"
                    value={officerForm.badge_number}
                    onChange={handleOfficerChange}
                  />
                  {renderFieldError('badge_number', officerFieldErrors)}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="officer-password">Password <span className="required">*</span></label>
                  <div className="password-field">
                    <input
                      id="officer-password"
                      name="password"
                      type={showOfficerPassword ? 'text' : 'password'}
                      style={{ ...inputStyle, borderColor: officerFieldErrors.password ? 'var(--danger)' : 'var(--border)', paddingRight: '44px' }}
                      placeholder="Minimum 8 characters"
                      value={officerForm.password}
                      onChange={handleOfficerChange}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowOfficerPassword(prev => !prev)}
                      aria-label={showOfficerPassword ? 'Hide password' : 'Show password'}
                    >
                      {showOfficerPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {renderFieldError('password', officerFieldErrors) || (
                    <div className="form-hint">Must be at least 8 characters and include both letters and numbers.</div>
                  )}
                </div>

                <div className="field">
                  <label style={labelStyle} htmlFor="officer-password-confirmation">Confirm Password <span className="required">*</span></label>
                  <div className="password-field">
                    <input
                      id="officer-password-confirmation"
                      name="password_confirmation"
                      type={showOfficerPasswordConfirmation ? 'text' : 'password'}
                      style={{ ...inputStyle, borderColor: officerFieldErrors.password_confirmation ? 'var(--danger)' : 'var(--border)', paddingRight: '44px' }}
                      placeholder="Re-enter password"
                      value={officerForm.password_confirmation}
                      onChange={handleOfficerChange}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowOfficerPasswordConfirmation(prev => !prev)}
                      aria-label={showOfficerPasswordConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
                    >
                      {showOfficerPasswordConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {renderFieldError('password_confirmation', officerFieldErrors)}
                </div>
              </div>

              <div className="sheet__foot">
                <button type="button" className="btn btn--ghost btn--sm" onClick={closeCreateOfficer} disabled={officerSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--dark btn--sm" disabled={officerSaving}>
                  <UserPlus size={13} style={{ marginRight: 6 }} /> {officerSaving ? 'Creating...' : 'Create Officer Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ACCOUNT MODAL */}
      {viewingUser && (
        <div className="modal-overlay" onClick={closeViewModal}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Account details">
            <div className="sheet__head">
              <div>
                <h3>Account Details</h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                  {viewingUser.email}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeViewModal} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="sheet__body">
              {viewError && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} /> <div>{viewError}</div>
                </div>
              )}

              {viewLoading ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: '13px' }}>
                  Loading account details...
                </div>
              ) : viewDetail ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: 'var(--navy-800)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, flexShrink: 0,
                    }}>
                      {viewDetail.user.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>{viewDetail.user.name}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`status-pill ${getRolePillClass(viewDetail.user.role)}`}>
                          {roleLabel(viewDetail.user.role)}
                        </span>
                        <span className={`status-pill ${viewDetail.user.is_active ? 'st-resolved' : 'st-off'}`}>
                          {viewDetail.user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '12px' }}>
                    {[
                      [<Mail key="i1" size={14} />, 'Email Address', viewDetail.user.email],
                      [<Phone key="i2" size={14} />, 'Mobile Number', viewDetail.user.phone || 'Not provided'],
                      [<MapPin key="i3" size={14} />, 'Address', viewDetail.user.address || 'Not provided'],
                      [<BadgeCheck key="i4" size={14} />, 'Badge Number', viewDetail.user.badge_number || 'Not applicable'],
                      [<User key="i5" size={14} />, 'Account ID', `RW-USR-${viewDetail.user.id}`],
                      [<Shield key="i6" size={14} />, 'Reports Filed', viewDetail.reports_count],
                      [<Shield key="i7" size={14} />, 'Case Assignments', viewDetail.assignments_count],
                      [<Shield key="i8" size={14} />, 'Notifications Sent', viewDetail.notifications_count],
                    ].map(([icon, label, value], idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{icon}</span>
                        <span style={{ fontSize: '12px', color: 'var(--ink-mute)', minWidth: '150px' }}>{label}</span>
                        <span style={{ fontSize: '13.5px', color: 'var(--ink)', fontWeight: 600, wordBreak: 'break-word' }}>{value}</span>
                      </div>
                    ))}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}><RefreshCw size={14} /></span>
                      <span style={{ fontSize: '12px', color: 'var(--ink-mute)', minWidth: '150px' }}>Created</span>
                      <span style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                        {new Date(viewDetail.user.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="sheet__foot">
              <button type="button" className="btn btn--ghost btn--sm" onClick={closeViewModal}>
                Close
              </button>
              <button
                type="button"
                className="btn btn--dark btn--sm"
                onClick={() => {
                  const target = viewingUser;
                  closeViewModal();
                  openEditModal(target);
                }}
              >
                <Edit2 size={13} /> Edit Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {editingUser && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet__head">
              <div>
                <h3>Edit Account: {editingUser.name}</h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                  {editingUser.email} &bull; Currently {roleLabel(editingUser.role)} &bull; {editingUser.is_active ? 'Active' : 'Inactive'}
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

            <form onSubmit={handleUpdateUser} noValidate>
              <div className="sheet__body">
                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="edit-user-name">Full Name</label>
                  <input
                    id="edit-user-name"
                    type="text"
                    style={{ ...inputStyle, borderColor: fieldErrors.name ? 'var(--danger)' : 'var(--border)' }}
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      setFieldErrors(prev => ({ ...prev, name: undefined }));
                    }}
                  />
                  {renderFieldError('name')}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="edit-user-email">Email Address</label>
                  <input
                    id="edit-user-email"
                    type="email"
                    style={{ ...inputStyle, borderColor: fieldErrors.email ? 'var(--danger)' : 'var(--border)' }}
                    placeholder="e.g. officer.santos@traffic.gov"
                    value={formEmail}
                    onChange={(e) => {
                      setFormEmail(e.target.value);
                      setFieldErrors(prev => ({ ...prev, email: undefined }));
                    }}
                  />
                  {renderFieldError('email')}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="edit-user-phone">Mobile Number</label>
                  <PhoneInput
                    id="edit-user-phone"
                    name="phone"
                    style={{ ...inputStyle, borderColor: fieldErrors.phone ? 'var(--danger)' : 'var(--border)' }}
                    placeholder="09171234567"
                    value={formPhone}
                    onChange={(e) => {
                      setFormPhone(e.target.value);
                      setFieldErrors(prev => ({ ...prev, phone: undefined }));
                    }}
                  />
                  {renderFieldError('phone')}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="edit-user-address">Address</label>
                  <input
                    id="edit-user-address"
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. 123 Rizal St, Brgy. Catmon, Malolos, Bulacan"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                  {renderFieldError('address')}
                </div>

                <div className="field" style={{ marginBottom: '16px' }}>
                  <label style={labelStyle} htmlFor="edit-user-role">Assigned System Role</label>
                  <select
                    id="edit-user-role"
                    style={inputStyle}
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    disabled={editingUser.id === currentUser?.id}
                  >
                    <option value="reporter">Citizen Resident / Reporter</option>
                    <option value="officer">Traffic Investigator / Field Officer</option>
                    <option value="admin">System Administrator</option>
                  </select>
                  {editingUser.id === currentUser?.id && (
                    <div className="form-hint">You cannot change your own role.</div>
                  )}
                </div>

                {formRole === 'officer' && (
                  <div className="field" style={{ marginBottom: '16px' }}>
                    <label style={labelStyle} htmlFor="edit-user-badge">Official Badge Number</label>
                    <input
                      id="edit-user-badge"
                      type="text"
                      style={inputStyle}
                      placeholder="e.g. PO3-8821"
                      value={formBadge}
                      onChange={(e) => setFormBadge(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-hint" style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <Shield size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                  Account activation is managed from the Actions column, not here.
                </div>
              </div>

              <div className="sheet__foot">
                <button type="button" className="btn btn--ghost btn--sm" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--dark btn--sm" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS CHANGE CONFIRMATION */}
      {statusTarget && (
        <div className="modal-overlay" onClick={cancelStatusChange}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ maxWidth: '460px' }}>
            <div className="sheet__head">
              <div>
                <h3>{statusTarget.is_active ? 'Deactivate Account' : 'Activate Account'}</h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: '0.82rem', margin: '3px 0 0' }}>
                  {statusTarget.name} &bull; {statusTarget.email}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={cancelStatusChange} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="sheet__body">
              <div style={{ padding: '14px 16px', borderRadius: '8px', background: statusTarget.is_active ? '#fff7ed' : '#f0fdf4', border: `1px solid ${statusTarget.is_active ? '#fed7aa' : '#bbf7d0'}`, fontSize: '13px', color: 'var(--ink)', lineHeight: 1.55 }}>
                {statusTarget.is_active ? (
                  <>
                    <strong>Deactivate {statusTarget.name}'s account?</strong>
                    <div style={{ marginTop: '6px' }}>
                      They will be signed out immediately and blocked from logging in until the
                      account is reactivated. Their submitted reports and case history are preserved.
                    </div>
                  </>
                ) : (
                  <>
                    <strong>Reactivate {statusTarget.name}'s account?</strong>
                    <div style={{ marginTop: '6px' }}>
                      They will be able to sign in and use the system again with their existing role.
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="sheet__foot">
              <button type="button" className="btn btn--ghost btn--sm" onClick={cancelStatusChange} disabled={statusBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={confirmStatusChange}
                disabled={statusBusy}
                style={{
                  background: statusTarget.is_active ? '#dc2626' : '#15803d',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                }}
              >
                {statusBusy
                  ? 'Updating...'
                  : (statusTarget.is_active ? 'Yes, Deactivate' : 'Yes, Activate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}