import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, AlertCircle, UserPlus } from 'lucide-react';

export default function RegisterPage({ onNavigate }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      setError('Passwords do not match. Please verify your entries.');
      return;
    }

    setLoading(true);

    try {
      await register(formData);
      onNavigate('user-dashboard');
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login__main">
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink-soft, #5a6b8a)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '16px',
            padding: 0
          }}
        >
          &larr; Back to RoadWatch Home
        </button>
        <div className="auth-card" style={{ maxWidth: '100%' }}>
        <div className="auth-head">
          <div className="auth-mark">
            <UserPlus size={22} color="#ffb020" />
          </div>
          <h1>Create Citizen Account</h1>
          <p className="sub">Register to submit verified accident reports and track case investigation</p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '18px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Full Name <span className="required">*</span>
            </label>
            <input
              type="text"
              name="name"
              className="form-control"
              placeholder="e.g. Maria Santos Dela Cruz"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Email Address <span className="required">*</span>
            </label>
            <input
              type="email"
              name="email"
              className="form-control"
              placeholder="e.g. maria.delacruz@gmail.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Contact / Mobile Number
            </label>
            <input
              type="tel"
              name="phone"
              className="form-control"
              placeholder="+63 917 123 4567"
              value={formData.phone}
              onChange={handleChange}
            />
            <div className="form-hint" style={{ fontSize: '11px', color: 'var(--ink-mute)', marginTop: '4px' }}>
              Used for official verification by traffic officers when required.
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Password <span className="required">*</span>
            </label>
            <input
              type="password"
              name="password"
              className="form-control"
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <div className="form-hint" style={{ fontSize: '11px', color: 'var(--ink-mute)', marginTop: '4px' }}>
              Must be at least 8 characters and include both letters and numbers.
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Confirm Password <span className="required">*</span>
            </label>
            <input
              type="password"
              name="password_confirmation"
              className="form-control"
              placeholder="Re-enter password"
              value={formData.password_confirmation}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 700,
              background: 'var(--navy-900, #0a1428)',
              color: '#ffffff',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Registering Account...' : 'Create Citizen Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: 'var(--ink-soft)' }}>
          Already have an account?{' '}
          <span
            style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}
            onClick={() => onNavigate('login')}
          >
            Sign In
          </span>
        </div>
      </div>
    </div>
  </div>
);
}
