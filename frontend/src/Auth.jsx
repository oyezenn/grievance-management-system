import { useState } from 'react';
import { apiFetch } from './api';

export default function Auth({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', is_admin: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await apiFetch('/register', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        setLoading(false);
        alert('Registration successful! Please log in.');
        setIsRegister(false);
        // Clear password for security
        setFormData(prev => ({ ...prev, password: '' }));
      } else {
        const data = await apiFetch('/login', {
          method: 'POST',
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });
        setLoading(false);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <div style={styles.authContainer} className="fade-in">
      {/* Background glowing blobs */}
      <div style={styles.glowBlob1}></div>
      <div style={styles.glowBlob2}></div>

      <div className="glass-panel-glow" style={styles.authCard}>
        {/* Brand Logo and Title */}
        <div style={styles.brandHeader}>
          <div style={styles.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <h1 style={styles.brandTitle}>GrievanceFlow <span style={styles.aiTag}>AI</span></h1>
          <p style={styles.brandSubtitle}>Intelligent Resolution & Tracking System</p>
        </div>

        {/* Tab Toggle */}
        <div style={styles.tabContainer}>
          <button
            type="button"
            style={{
              ...styles.tabButton,
              color: !isRegister ? '#ffffff' : 'var(--text-secondary)',
              background: !isRegister ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: !isRegister ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
            }}
            onClick={() => {
              setIsRegister(false);
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{
              ...styles.tabButton,
              color: isRegister ? '#ffffff' : 'var(--text-secondary)',
              background: isRegister ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: isRegister ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
            }}
            onClick={() => {
              setIsRegister(true);
              setError('');
            }}
          >
            Register
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div style={styles.errorBox} className="fade-in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-input"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={styles.paddedInput}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                style={styles.paddedInput}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type="password"
                id="password"
                name="password"
                className="form-input"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                style={styles.paddedInput}
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group" style={{ marginTop: '10px' }}>
              <label className="custom-checkbox-container">
                <input
                  type="checkbox"
                  name="is_admin"
                  checked={formData.is_admin}
                  onChange={handleChange}
                  className="custom-checkbox-input"
                />
                <span className="custom-checkbox-box"></span>
                <span className="custom-checkbox-text">
                  Register as Administrative Coordinator
                </span>
              </label>
              <p style={styles.checkboxHint}>Grants permission to review, update status, and manage incoming grievances.</p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <div style={styles.loadingSpinner}></div>
            ) : (
              <>
                <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12,5 19,12 12,19" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            {isRegister ? 'Already have an account?' : "Don't have an account yet?"}
            {' '}
            <span
              style={styles.footerLink}
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
            >
              {isRegister ? 'Sign In Here' : 'Create an Account'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  authContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    padding: '24px',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  },
  glowBlob1: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    width: '350px',
    height: '350px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)',
    zIndex: -1,
  },
  glowBlob2: {
    position: 'absolute',
    bottom: '15%',
    right: '10%',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(0,0,0,0) 70%)',
    zIndex: -1,
  },
  authCard: {
    width: '100%',
    maxWidth: '460px',
    padding: '40px',
    boxSizing: 'border-box',
    position: 'relative',
  },
  brandHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
    color: '#ffffff',
    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
    marginBottom: '16px',
  },
  brandTitle: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 6px 0',
    letterSpacing: '-0.03em',
  },
  aiTag: {
    color: 'var(--secondary)',
    fontSize: '24px',
    fontWeight: '800',
    textShadow: '0 0 10px rgba(6, 182, 212, 0.4)',
  },
  brandSubtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
  },
  tabContainer: {
    display: 'flex',
    background: 'rgba(0, 0, 0, 0.2)',
    padding: '4px',
    borderRadius: '12px',
    marginBottom: '28px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  tabButton: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#f87171',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '24px',
    textAlign: 'left',
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  },
  paddedInput: {
    paddingLeft: '44px',
  },
  checkboxContainer: {
    display: 'flex',
    alignItems: 'flex-start',
    cursor: 'pointer',
    position: 'relative',
    userSelect: 'none',
    gap: '10px',
    marginTop: '6px',
  },
  checkboxInput: {
    position: 'absolute',
    opacity: 0,
    cursor: 'pointer',
    height: 0,
    width: 0,
  },
  checkboxCustom: {
    position: 'relative',
    height: '18px',
    width: '18px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    transition: 'all 0.2s',
    marginTop: '2px',
    flexShrink: 0,
    '&::after': {
      content: '""',
      position: 'absolute',
      display: 'none',
      left: '5px',
      top: '2px',
      width: '4px',
      height: '8px',
      border: 'solid white',
      borderWidth: '0 2px 2px 0',
      transform: 'rotate(45deg)',
    }
  },
  checkboxText: {
    fontSize: '13.5px',
    color: 'var(--text-primary)',
    fontWeight: 500,
    textAlign: 'left',
    lineHeight: '20px',
  },
  checkboxHint: {
    margin: '4px 0 0 28px',
    fontSize: '12px',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
    textAlign: 'left',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    fontSize: '15px',
    marginTop: '16px',
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  footer: {
    marginTop: '28px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  footerLink: {
    color: 'var(--secondary)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'color 0.2s',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    '&:hover': {
      color: 'var(--secondary-hover)',
    }
  }
};