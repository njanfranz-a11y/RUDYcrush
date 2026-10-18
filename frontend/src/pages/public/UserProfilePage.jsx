import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, Lock, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

export default function UserProfilePage() {
  const { user, updateCurrentUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== newPasswordConfirmation) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        phone,
      };

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
        payload.new_password_confirmation = newPasswordConfirmation;
      }

      const res = await api.updateProfile(payload);
      if (res.data?.success) {
        updateCurrentUser(res.data.data.user);
        setSuccess('Profile updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirmation('');
      }
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div className="command-eyebrow" style={{ color: '#0284c7' }}>
          <User size={14} /> Account Settings &bull; Credential Management
        </div>
        <div className="card" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>{user?.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`badge badge-role-${user?.role}`}>{user?.role}</span>
              {user?.badge_number && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Badge: <strong>{user.badge_number}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={16} /> <div>{error}</div>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={16} /> <div>{success}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Personal Information</h3>
          
          <div className="form-group">
            <label className="form-label">Full Name <span className="required">*</span></label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address (Read Only)</label>
            <input
              type="email"
              className="form-control"
              value={user?.email || ''}
              disabled
              style={{ backgroundColor: '#f8fafc', color: 'var(--text-muted)' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone Number</label>
            <input
              type="tel"
              className="form-control"
              placeholder="+63 917 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <h3 style={{ fontSize: '16px', marginTop: '28px', marginBottom: '16px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            Change Password (Optional)
          </h3>

          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter current password to verify"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Leave blank to keep unchanged"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Re-enter new password"
              value={newPasswordConfirmation}
              onChange={(e) => setNewPasswordConfirmation(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
