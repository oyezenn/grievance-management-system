import { useState, useEffect } from 'react';
import Auth from './Auth';
import Dashboard from './Dashboard';

function AccessDenied({ onNavigate, theme, onToggleTheme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)', padding: '24px' }}>
      <div className="gov-top-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="gov-flag-icon">🇮🇳</span>
          <span>National Grievance Portal | Government of India • Official Secure Site</span>
        </div>
        <button onClick={onToggleTheme} style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, padding: 0 }}>
          {theme === 'light' ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <span>Light Mode</span>
            </>
          )}
        </button>
      </div>
      <div style={{ maxWidth: '480px', width: '100%', padding: '40px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', marginBottom: '20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: '0 0 24px 0', lineHeight: '1.6' }}>
          Administrative privileges are required to access this portal section. Please contact the system administrator if you believe this is an error.
        </p>
        <button className="btn btn-primary" onClick={() => onNavigate('/')} style={{ width: '100%', padding: '12px', background: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
          Return to Citizen Dashboard
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  const isAdminRoute = currentPath === '/admin';

  if (!user) {
    return (
      <Auth 
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          if (loggedInUser.is_admin) {
            navigate('/admin');
          } else {
            navigate('/');
          }
        }} 
        theme={theme} 
        onToggleTheme={toggleTheme} 
      />
    );
  }

  if (isAdminRoute && !user.is_admin) {
    return <AccessDenied onNavigate={navigate} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <Dashboard 
      user={user} 
      onLogout={handleLogout} 
      theme={theme} 
      onToggleTheme={toggleTheme} 
      currentPath={currentPath}
      onNavigate={navigate}
      isAdminRoute={isAdminRoute}
    />
  );
}