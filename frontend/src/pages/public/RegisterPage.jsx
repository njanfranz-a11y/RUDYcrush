import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, UserPlus, Eye, EyeOff } from 'lucide-react';
import PhoneInput from '../../components/common/PhoneInput';
import { isValidPhoneNumber, PHONE_ERROR_MESSAGE, PHONE_PLACEHOLDER } from '../../services/phone';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validate the registration form.
 * Returns an object of field name -> first error message. Empty object = valid.
 */
const validateForm = (formData) => {
  const errors = {};

  const name = formData.name.trim();
  if (!name) {
    errors.name = 'Full name is required.';
  } else if (name.length < 2) {
    errors.name = 'Full name must be at least 2 characters.';
  }

  const email = formData.email.trim();
  if (!email) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address (e.g. maria.delacruz@gmail.com).';
  }

  const phone = formData.phone.trim();
  if (phone && !isValidPhoneNumber(phone)) {
    errors.phone = PHONE_ERROR_MESSAGE;
  }

  const address = formData.address.trim();
  if (!address) {
    errors.address = 'Address is required.';
  } else if (address.length < 5) {
    errors.address = 'Please enter a more complete address.';
  }

  const password = formData.password;
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Password must include both letters and numbers.';
  }

  if (!formData.password_confirmation) {
    errors.password_confirmation = 'Please confirm your password.';
  } else if (formData.password !== formData.password_confirmation) {
    errors.password_confirmation = 'Passwords do not match.';
  }

  return errors;
};

export default function RegisterPage({ onNavigate }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    password_confirmation: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the citizen edits it.
    setErrors(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const fieldErrors = validateForm(formData);
    setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
  };

  // Only surface an error once the citizen has actually left the field.
  const visibleError = useMemo(
    () => (name) => (touched[name] ? errors[name] : undefined),
    [touched, errors]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const fieldErrors = validateForm(formData);

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setTouched({
        name: true,
        email: true,
        phone: true,
        address: true,
        password: true,
        password_confirmation: true,
      });
      return;
    }

    setLoading(true);

    try {
      await register({
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
      });
      onNavigate('user-dashboard');
    } catch (err) {
      // Laravel returns 422 with per-field messages; map them onto the inputs.
      if (err.fieldErrors) {
        const mapped = {};
        Object.entries(err.fieldErrors).forEach(([name, messages]) => {
          mapped[name] = Array.isArray(messages) ? messages[0] : messages;
        });
        setErrors(mapped);
        setTouched({
          name: true,
          email: true,
          phone: true,
          address: true,
          password: true,
          password_confirmation: true,
        });
      }
      setError(err.friendlyMessage || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (name) =>
    `form-control${visibleError(name) ? ' error' : ''}`;

  const renderFieldError = (name) =>
    visibleError(name) ? (
      <span className="form-error">{visibleError(name)}</span>
    ) : null;

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

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }} htmlFor="reg-name">
              Full Name <span className="required">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              name="name"
              className={fieldClass('name')}
              placeholder="e.g. Maria Santos Dela Cruz"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-invalid={Boolean(visibleError('name'))}
            />
            {renderFieldError('name')}
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }} htmlFor="reg-email">
              Email Address <span className="required">*</span>
            </label>
            <input
              id="reg-email"
              type="email"
              name="email"
              className={fieldClass('email')}
              placeholder="e.g. maria.delacruz@gmail.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-invalid={Boolean(visibleError('email'))}
            />
            {renderFieldError('email')}
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }} htmlFor="reg-phone">
              Contact / Mobile Number
            </label>
            <PhoneInput
              id="reg-phone"
              type="tel"
              name="phone"
              className={fieldClass('phone')}
              placeholder={PHONE_PLACEHOLDER}
              value={formData.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-invalid={Boolean(visibleError('phone'))}
            />
            {renderFieldError('phone') || (
              <div className="form-hint" style={{ fontSize: '11px', color: 'var(--ink-mute)', marginTop: '4px' }}>
                Used for official verification by traffic officers when required.
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }} htmlFor="reg-city">
              Address <span className="required">*</span>
            </label>
            <input
              id="reg-address"
              type="text"
              name="address"
              className={fieldClass('address')}
              placeholder="e.g. 123 Rizal St, Brgy. Catmon, Malolos, Bulacan"
              value={formData.address}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-invalid={Boolean(visibleError('address'))}
            />
            {renderFieldError('address')}
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }} htmlFor="reg-password">
              Password <span className="required">*</span>
            </label>
            <div className="password-field">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                className={fieldClass('password')}
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-invalid={Boolean(visibleError('password'))}
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
            {renderFieldError('password') || (
              <div className="form-hint" style={{ fontSize: '11px', color: 'var(--ink-mute)', marginTop: '4px' }}>
                Must be at least 8 characters and include both letters and numbers.
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }} htmlFor="reg-password-confirmation">
              Confirm Password <span className="required">*</span>
            </label>
            <div className="password-field">
              <input
                id="reg-password-confirmation"
                type={showPasswordConfirmation ? 'text' : 'password'}
                name="password_confirmation"
                className={fieldClass('password_confirmation')}
                placeholder="Re-enter password"
                value={formData.password_confirmation}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-invalid={Boolean(visibleError('password_confirmation'))}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPasswordConfirmation(prev => !prev)}
                aria-label={showPasswordConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
                title={showPasswordConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
              >
                {showPasswordConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {renderFieldError('password_confirmation')}
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