import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, AlertCircle, LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      if (user.role === 'admin') {
        onNavigate('admin-dashboard');
      } else if (user.role === 'officer') {
        onNavigate('officer-dashboard');
      } else {
        onNavigate('user-dashboard');
      }
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login__main">
      <div style={{ width: '100%', maxWidth: '440px' }}>
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
          {/* Header with official mark from reference */}
          <div className="auth-head">
            <div className="auth-mark">
              <AlertTriangle size={22} color="#ffb020" />
            </div>
            <h1>Sign In to RoadWatch</h1>
            <p className="sub">Enter your registered email and password to access the portal</p>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '18px' }}>
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password <span className="required">*</span>
              </label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
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
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={loading}
            >
              <LogIn size={16} />
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: 'var(--ink-soft)' }}>
            Don't have an account?{' '}
            <span
              style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => onNavigate('register')}
            >
              Register as Citizen Reporter
            </span>
          </div>

          {/* Portal Access Note */}
          <div className="staff-note">
            <b>Official Portal Access</b>
            <span>Bulacan Incident Response Network &middot; Sign in with your registered email and current password to access your role-specific dashboard.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
