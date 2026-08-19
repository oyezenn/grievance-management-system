import { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api';

export default function Dashboard({ user, onLogout, theme, onToggleTheme, currentPath, onNavigate, isAdminRoute }) {
  const [grievances, setGrievances] = useState([]);
  const [lang, setLang] = useState('en');
  
  const showAdminQueue = isAdminRoute && user.is_admin;
  
  const [activeTab, setActiveTab] = useState(showAdminQueue ? 'queue' : 'home');
  const [newGrievance, setNewGrievance] = useState({ category: '', description: '', urgency: 'Low', location: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  
  // Filtering & Search
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Tagging States
  const [isAiClassifying, setIsAiClassifying] = useState(false);
  const [aiTagResult, setAiTagResult] = useState(null);
  const [hasTappedAi, setHasTappedAi] = useState(false);

  // General States
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Track Grievance States
  const [trackId, setTrackId] = useState('');
  const [trackedGrievance, setTrackedGrievance] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);

  // Refs for tracking changes
  const lastClassifiedText = useRef('');

  const handleTrackGrievance = async (e) => {
    e.preventDefault();
    if (!trackId.trim()) return;
    setTrackError('');
    setTrackedGrievance(null);
    setTrackLoading(true);

    try {
      const data = await apiFetch(`/grievances/${trackId.trim()}`);
      setTrackedGrievance(data);
    } catch (err) {
      setTrackError(err.message || 'Grievance not found or access denied.');
    } finally {
      setTrackLoading(false);
    }
  };

  // Feedback Form States
  const [feedbackType, setFeedbackType] = useState('Ease of Use');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbacksList, setFeedbacksList] = useState([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    setError('');
    setFeedbackSuccess('');

    try {
      await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          feedback_type: feedbackType,
          rating: feedbackRating,
          comments: feedbackComments
        })
      });
      setFeedbackSuccess(lang === 'hi' ? 'आपकी प्रतिक्रिया सफलतापूर्वक दर्ज कर ली गई है। धन्यवाद!' : 'Feedback submitted successfully. Thank you!');
      setFeedbackComments('');
      setFeedbackRating(5);
      setFeedbackType('Ease of Use');
    } catch (err) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const loadFeedbacks = async () => {
    if (!user.is_admin) return;
    setLoadingFeedbacks(true);
    try {
      const data = await apiFetch('/feedbacks');
      setFeedbacksList(data);
    } catch (err) {
      console.error('Failed to load feedbacks:', err.message);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feedback' && user.is_admin) {
      loadFeedbacks();
    }
  }, [activeTab]);

  // Categories list
  const categories = [
    'IT Support',
    'Facilities',
    'Human Resources',
    'Finance & Billing',
    'Academic / Coursework',
    'General Inquiry'
  ];

  const loadGrievances = async (statusVal = statusFilter, categoryVal = categoryFilter) => {
    try {
      setError('');
      let url = '/grievances';
      const params = [];
      if (statusVal && statusVal !== 'All') {
        params.push(`status=${statusVal}`);
      }
      if (categoryVal) {
        params.push(`category=${encodeURIComponent(categoryVal)}`);
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      const data = await apiFetch(url);
      setGrievances(data);
    } catch (err) {
      setError(err.message || 'Failed to load grievances.');
    }
  };

  useEffect(() => {
    loadGrievances();
  }, [statusFilter, categoryFilter, isAdminRoute]);

  useEffect(() => {
    setActiveTab(showAdminQueue ? 'queue' : 'list');
  }, [isAdminRoute]);

  // Trigger AI Auto-Tagging
  const triggerAiClassification = async (descText) => {
    if (!descText || descText.trim().length < 10) return;
    if (descText === lastClassifiedText.current) return; // Prevent redundant calls

    setIsAiClassifying(true);
    setAiTagResult(null);
    setError('');

    try {
      const result = await apiFetch('/classify', {
        method: 'POST',
        body: JSON.stringify({ description: descText }),
      });
      
      setNewGrievance(prev => ({
        ...prev,
        category: result.category,
        urgency: result.urgency
      }));
      setAiTagResult(result);
      setHasTappedAi(true);
      lastClassifiedText.current = descText;
    } catch (err) {
      console.error('AI classification failed, falling back to manual inputs:', err.message);
    } finally {
      setIsAiClassifying(false);
    }
  };

  const handleDescriptionBlur = (e) => {
    triggerAiClassification(e.target.value);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGrievance.description.trim()) {
      alert('Description is required.');
      return;
    }
    if (!newGrievance.location.trim()) {
      alert('Location is required.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('description', newGrievance.description.trim());
      formData.append('category', newGrievance.category || 'General Inquiry');
      formData.append('urgency', newGrievance.urgency || 'Low');
      formData.append('location', newGrievance.location.trim());
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await apiFetch('/grievances', {
        method: 'POST',
        body: formData,
      });
      
      // Reset form
      setNewGrievance({ category: '', description: '', urgency: 'Low', location: '' });
      setImageFile(null);
      setImagePreview('');
      setAiTagResult(null);
      setHasTappedAi(false);
      lastClassifiedText.current = '';
      
      setSuccessMsg('Grievance submitted successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      
      await loadGrievances();
      setActiveTab('list'); // Switch to list tab after submission
    } catch (err) {
      alert(err.message || 'Failed to submit grievance.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await apiFetch(`/grievances/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      
      // Update local state directly for seamless UI experience
      setGrievances(prev => prev.map(g => g.id === id ? { ...g, status } : g));
      
      setSuccessMsg(`Grievance #${id} status updated to ${status}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update status.');
      loadGrievances(); // Reload to sync with db if error
    }
  };

  const handleAssigneeChange = async (id, assigned_to) => {
    try {
      await apiFetch(`/grievances/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to }),
      });
      
      // Update local state directly for seamless UI experience
      setGrievances(prev => prev.map(g => g.id === id ? { ...g, assigned_to: assigned_to || null } : g));
      
      setSuccessMsg(`Grievance #${id} assignment updated.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update assignee.');
      loadGrievances(); // Reload to sync with db if error
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this grievance?')) return;
    try {
      await apiFetch(`/grievances/${id}`, { method: 'DELETE' });
      setGrievances(prev => prev.filter(g => g.id !== id));
      
      setSuccessMsg('Grievance deleted successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to delete grievance.');
    }
  };

  // Filter and Search logic
  const filteredGrievances = grievances.filter(item => {
    const matchesSearch = 
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.user_name && item.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.user_email && item.user_email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'All' || item.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  // Stats Calculations
  const stats = {
    total: grievances.length,
    pending: grievances.filter(g => g.status === 'submitted').length,
    inProgress: grievances.filter(g => g.status === 'in-progress').length,
    resolved: grievances.filter(g => g.status === 'resolved').length,
    critical: grievances.filter(g => g.urgency === 'Critical' || g.urgency === 'High').length,
  };

  return (
    <div style={styles.dashboardContainer} className="fade-in">
      <div className="gov-top-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="gov-flag-icon">🇮🇳</span>
          <span>National Grievance Portal | Government of India • Official Secure Site</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Language Selector */}
          <div style={{ display: 'flex', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
            <span style={{ cursor: 'pointer', color: lang === 'en' ? '#f59e0b' : '#e2e8f0' }} onClick={() => setLang('en')}>English</span>
            <span>|</span>
            <span style={{ cursor: 'pointer', color: lang === 'hi' ? '#f59e0b' : '#e2e8f0' }} onClick={() => setLang('hi')}>हिन्दी</span>
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
      </div>

      <div style={styles.contentWrapper}>
        {/* Top Navbar */}
        <header style={styles.navbar} className="glass-panel">
        <div style={styles.navLogo}>
          {/* Government Emblem Styled SVG Icon */}
          <div style={styles.emblemWrapper}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={styles.navTitle}>{lang === 'hi' ? 'लोक निवारण पोर्टल' : 'Lok Nivaran Portal'}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '-2px' }}>
              {lang === 'hi' ? 'सार्वजनिक शिकायत निवारण प्रणाली' : 'Public Grievance Redressal Mechanism'}
            </span>
          </div>
        </div>

        <div style={styles.navUserSection}>
          {user.is_admin && (
            <button 
              onClick={() => onNavigate(isAdminRoute ? '/' : '/admin')} 
              className="btn btn-primary"
              style={{ marginRight: '8px', padding: '8px 14px', fontSize: '13px', background: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
            >
              {isAdminRoute ? (lang === 'hi' ? 'नागरिक पोर्टल' : 'Citizen Portal') : (lang === 'hi' ? 'प्रशासक पोर्टल' : 'Admin Portal')}
            </button>
          )}

          <div style={styles.userProfile}>
            <div style={styles.avatar}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={styles.userDetails}>
              <span style={styles.userName}>{user.name}</span>
              <span style={{ 
                ...styles.userRole, 
                color: user.is_admin ? 'var(--secondary)' : 'var(--text-secondary)'
              }}>
                {user.is_admin ? (lang === 'hi' ? 'प्रशासनिक समन्वयक' : 'Administrative Coordinator') : (lang === 'hi' ? 'सामान्य नागरिक' : 'General Citizen')}
              </span>
            </div>
          </div>
          
          <button onClick={onLogout} className="btn btn-secondary" style={styles.logoutBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span style={styles.logoutText}>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Sub-navigation bar representing the official portal menu */}
      <nav style={styles.subNavbar} className="glass-panel">
        <div style={styles.subNavLinks}>
          <button 
            style={{ 
              ...styles.subNavLink, 
              borderBottom: activeTab === 'home' ? '3px solid var(--secondary)' : '3px solid transparent',
              color: activeTab === 'home' ? 'var(--text-primary)' : 'var(--text-muted)'
            }} 
            onClick={() => setActiveTab('home')}
          >
            {lang === 'hi' ? 'मुख्य पृष्ठ' : 'Home'}
          </button>
          {!showAdminQueue && (
            <button 
              style={{ 
                ...styles.subNavLink, 
                borderBottom: activeTab === 'submit' ? '3px solid var(--secondary)' : '3px solid transparent',
                color: activeTab === 'submit' ? 'var(--text-primary)' : 'var(--text-muted)'
              }} 
              onClick={() => setActiveTab('submit')}
            >
              {lang === 'hi' ? 'शिकायत दर्ज करें' : 'Submit Grievance'}
            </button>
          )}
          <button 
            style={{ 
              ...styles.subNavLink, 
              borderBottom: activeTab === 'track' ? '3px solid var(--secondary)' : '3px solid transparent',
              color: activeTab === 'track' ? 'var(--text-primary)' : 'var(--text-muted)'
            }} 
            onClick={() => setActiveTab('track')}
          >
            {lang === 'hi' ? 'शिकायत ट्रैक करें' : 'Track Grievance'}
          </button>
          <button 
            style={{ 
              ...styles.subNavLink, 
              borderBottom: (activeTab === 'list' || activeTab === 'queue') ? '3px solid var(--secondary)' : '3px solid transparent',
              color: (activeTab === 'list' || activeTab === 'queue') ? 'var(--text-primary)' : 'var(--text-muted)'
            }} 
            onClick={() => setActiveTab(showAdminQueue ? 'queue' : 'list')}
          >
            {showAdminQueue ? (lang === 'hi' ? 'प्रशासनिक शिकायत सूची' : 'Administrative Queue') : (lang === 'hi' ? 'मेरी शिकायतें' : 'My Grievances')}
          </button>
          <button 
            style={{ 
              ...styles.subNavLink, 
              borderBottom: activeTab === 'faqs' ? '3px solid var(--secondary)' : '3px solid transparent',
              color: activeTab === 'faqs' ? 'var(--text-primary)' : 'var(--text-muted)'
            }} 
            onClick={() => setActiveTab('faqs')}
          >
            {lang === 'hi' ? 'सामान्य प्रश्न' : 'FAQs'}
          </button>
          <button 
            style={{ 
              ...styles.subNavLink, 
              borderBottom: activeTab === 'contact' ? '3px solid var(--secondary)' : '3px solid transparent',
              color: activeTab === 'contact' ? 'var(--text-primary)' : 'var(--text-muted)'
            }} 
            onClick={() => setActiveTab('contact')}
          >
            {lang === 'hi' ? 'संपर्क करें' : 'Contact Us'}
          </button>
        </div>
      </nav>

      {/* Toast Notification for quick actions */}
      {successMsg && (
        <div style={styles.toast} className="glass-panel fade-in">
          <div style={styles.toastTick}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span>{successMsg}</span>
        </div>
      )}

      <div style={styles.scrollContainer}>
        {/* KPI Cards section */}
        <section style={styles.statsSection}>
        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>{lang === 'hi' ? 'कुल प्रस्तुत' : 'Total Submitted'}</h4>
            <p style={styles.statVal}>{stats.total}</p>
          </div>
          <div style={{ ...styles.statIcon, background: 'rgba(30, 58, 138, 0.1)', color: 'var(--primary)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
        </div>

        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>{lang === 'hi' ? 'समीक्षा के अधीन' : 'Under Review'}</h4>
            <p style={styles.statVal}>{stats.pending}</p>
          </div>
          <div style={{ ...styles.statIcon, background: 'rgba(217, 119, 6, 0.1)', color: 'var(--secondary)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>

        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>{lang === 'hi' ? 'प्रगति पर' : 'In Progress'}</h4>
            <p style={styles.statVal}>{stats.inProgress}</p>
          </div>
          <div style={{ ...styles.statIcon, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--status-progress-text)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </div>
        </div>

        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>{lang === 'hi' ? 'समाधान किया गया' : 'Resolved'}</h4>
            <p style={styles.statVal}>{stats.resolved}</p>
          </div>
          <div style={{ ...styles.statIcon, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-resolved-text)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>{lang === 'hi' ? 'अस्वीकृत' : 'Rejected'}</h4>
            <p style={styles.statVal}>0</p>
          </div>
          <div style={{ ...styles.statIcon, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-rejected-text)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        </div>
      </section>

      {/* Main Tab Navigation & Controls */}
      <div style={styles.mainLayout}>
        <div style={styles.tabBarContainer}>
          <div style={{ flex: 1 }}></div>

          {/* Filtering Controls (Only shown for list/queue tabs or admin route) */}
          {(activeTab === 'list' || activeTab === 'queue' || showAdminQueue) && (
            <div style={styles.filterControls}>
              <div style={styles.searchWrapper}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={styles.searchIcon}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Search grievances..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.dropdownFilters}>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Status</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-input custom-select"
                    style={styles.filterSelect}
                  >
                    <option value="All">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Category</label>
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="form-input custom-select"
                    style={styles.filterSelect}
                  >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Urgency</label>
                  <select 
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                    className="form-input custom-select"
                    style={styles.filterSelect}
                  >
                    <option value="All">All Priorities</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p style={styles.errorText} className="fade-in">{error}</p>}

        {/* Tab 0a: Home Welcome Dashboard (Users and Admins) */}
        {activeTab === 'home' && (
          <div className="glass-panel fade-in" style={{ padding: '35px', textAlign: 'left' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: 'var(--primary)' }}>
              {lang === 'hi' ? 'लोक निवारण पोर्टल (समाधान) में आपका स्वागत है' : 'Welcome to the Lok Nivaran Portal (Samadhan)'}
            </h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {lang === 'hi' 
                ? 'यह पोर्टल भारत सरकार के प्रशासनिक सुधार और लोक शिकायत विभाग (DARPG) के तत्वावधान में देश के नागरिकों की शिकायतों को दर्ज करने, उन पर नज़र रखने और त्वरित समाधान प्राप्त करने के लिए एक सुरक्षित मंच प्रदान करता है।'
                : 'This portal provides a secure platform under the Department of Administrative Reforms & Public Grievances (DARPG), Government of India, for citizens to register their complaints, track resolution progress, and ensure transparent governance.'}
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', margin: '30px 0' }}>
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--secondary)' }}>
                  {lang === 'hi' ? '📝 त्वरित शिकायत पंजीकरण' : '📝 Simple Registration'}
                </h4>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-muted)' }}>
                  {lang === 'hi' ? 'श्रेणी, स्थान और विवरण के साथ अपनी शिकायत दर्ज करें। संदर्भ हेतु सहायक चित्र भी संलग्न कर सकते हैं।' : 'File grievances with category, location details, and optional supporting images securely.'}
                </p>
              </div>
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--secondary)' }}>
                  {lang === 'hi' ? '⚡ एआई संचालित सहायता' : '⚡ AI Assisted Processing'}
                </h4>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-muted)' }}>
                  {lang === 'hi' ? 'हमारा प्राकृतिक भाषा प्रसंस्करण इंजन शिकायत के विवरण के आधार पर सही श्रेणी और प्राथमिकता स्तर की स्वतः सिफारिश करता है।' : 'LangChain NLP auto-tagging classifies and recommends urgency settings based on your issue description.'}
                </p>
              </div>
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--secondary)' }}>
                  {lang === 'hi' ? '🔍 शिकायत की लाइव ट्रैकिंग' : '🔍 Live Tracking Status'}
                </h4>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-muted)' }}>
                  {lang === 'hi' ? 'प्रत्येक शिकायत को एक अनूठी संदर्भ आईडी दी जाती है। आप किसी भी समय अपनी शिकायत की स्थिति को लाइव ट्रैक कर सकते हैं।' : 'Use your unique Reference ID to check real-time department updates on a clean tracking timeline.'}
                </p>
              </div>
            </div>

            {!user.is_admin && (
              <button className="btn btn-primary" onClick={() => setActiveTab('submit')} style={{ padding: '12px 28px' }}>
                {lang === 'hi' ? 'नई शिकायत दर्ज करें' : 'Submit a Grievance Now'}
              </button>
            )}
          </div>
        )}

        {/* Tab 0b: Track Grievance (Timeline) */}
        {activeTab === 'track' && (
          <div className="glass-panel fade-in" style={{ padding: '30px', textAlign: 'left' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              {lang === 'hi' ? 'शिकायत की स्थिति ट्रैक करें' : 'Track Grievance Status'}
            </h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              {lang === 'hi' ? 'अपनी शिकायत का लाइव विवरण और प्रगति समयरेखा देखने के लिए संदर्भ आईडी दर्ज करें।' : 'Enter your unique numeric Reference ID below to view real-time department progress and assigned officer.'}
            </p>

            <form onSubmit={handleTrackGrievance} style={{ display: 'flex', gap: '12px', maxWidth: '500px', margin: '20px 0 30px 0' }}>
              <input 
                type="number" 
                placeholder={lang === 'hi' ? 'संदर्भ आईडी दर्ज करें (जैसे 90001)' : 'Enter Ref ID (e.g. 90001)'}
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                required
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={trackLoading} style={{ padding: '10px 24px' }}>
                {trackLoading ? (lang === 'hi' ? 'खोज रहे हैं...' : 'Tracking...') : (lang === 'hi' ? 'ट्रैक करें' : 'Track Status')}
              </button>
            </form>

            {trackError && <p style={{ color: 'var(--status-rejected-text)', fontWeight: 600, fontSize: '14px' }}>{trackError}</p>}

            {trackedGrievance && (
              <div className="glass-panel fade-in" style={{ padding: '24px', border: '1px solid var(--border-color)', marginTop: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--primary)' }}>
                  {lang === 'hi' ? `शिकायत संदर्भ #${trackedGrievance.id} विवरण` : `Grievance Reference #${trackedGrievance.id} Details`}
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px', fontSize: '14px' }}>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-muted)' }}>{lang === 'hi' ? 'श्रेणी' : 'Category'}</strong>
                    <span>{trackedGrievance.category || 'General Inquiry'}</span>
                  </div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-muted)' }}>{lang === 'hi' ? 'स्थान' : 'Location'}</strong>
                    <span>{trackedGrievance.location || 'N/A'}</span>
                  </div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-muted)' }}>{lang === 'hi' ? 'प्राथमिकता स्तर' : 'Urgency Priority'}</strong>
                    <span className={`badge ${
                      trackedGrievance.urgency === 'Critical' ? 'badge-urgency-critical' :
                      trackedGrievance.urgency === 'High' ? 'badge-urgency-high' :
                      trackedGrievance.urgency === 'Medium' ? 'badge-urgency-medium' : 'badge-urgency-low'
                    }`}>{trackedGrievance.urgency || 'Low'}</span>
                  </div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-muted)' }}>{lang === 'hi' ? 'प्रभारी अधिकारी/विभाग' : 'Assigned Official'}</strong>
                    <span>{trackedGrievance.assigned_to || (lang === 'hi' ? 'असंयोजित (प्रतीक्षारत)' : 'Unassigned (Awaiting Review)')}</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    {lang === 'hi' ? 'विवरण' : 'Description'}
                  </h4>
                  <p style={{ margin: '0 0 25px 0', color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: '1.5' }}>{trackedGrievance.description}</p>
                </div>

                {/* Tracking Progress Timeline */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <h4 style={{ margin: '0 0 20px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    {lang === 'hi' ? 'प्रगति समयरेखा' : 'Redressal Lifecycle Timeline'}
                  </h4>

                  <div className="timeline-wrapper">
                    <div className="timeline-row">
                      <div className="timeline-line-bg"></div>
                      <div className="timeline-line-active" style={{
                        width: 
                          trackedGrievance.status === 'resolved' ? '100%' :
                          trackedGrievance.status === 'in-progress' ? '75%' :
                          trackedGrievance.assigned_to ? '50%' : '25%'
                      }}></div>

                      <div className={`timeline-step completed`}>
                        <div className="timeline-dot">✓</div>
                        <span className="timeline-label">{lang === 'hi' ? 'जमा की गई' : 'Submitted'}</span>
                      </div>

                      <div className={`timeline-step ${trackedGrievance.status !== 'submitted' ? 'completed' : 'active'}`}>
                        <div className="timeline-dot">
                          {trackedGrievance.status !== 'submitted' ? '✓' : '2'}
                        </div>
                        <span className="timeline-label">{lang === 'hi' ? 'समीक्षाधीन' : 'Under Review'}</span>
                      </div>

                      <div className={`timeline-step ${trackedGrievance.assigned_to ? 'completed' : (trackedGrievance.status === 'submitted' ? 'pending' : 'active')}`}>
                        <div className="timeline-dot">
                          {trackedGrievance.assigned_to ? '✓' : '3'}
                        </div>
                        <span className="timeline-label">{lang === 'hi' ? 'अधिकारी नियुक्त' : 'Official Assigned'}</span>
                      </div>

                      <div className={`timeline-step ${trackedGrievance.status === 'resolved' ? 'completed' : (trackedGrievance.status === 'in-progress' ? 'active' : 'pending')}`}>
                        <div className="timeline-dot">
                          {trackedGrievance.status === 'resolved' ? '✓' : '4'}
                        </div>
                        <span className="timeline-label">{lang === 'hi' ? 'प्रगति पर' : 'In Progress'}</span>
                      </div>

                      <div className={`timeline-step ${trackedGrievance.status === 'resolved' ? 'completed' : 'pending'}`}>
                        <div className="timeline-dot">5</div>
                        <span className="timeline-label">{lang === 'hi' ? 'निवारण' : 'Resolved'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 0c: FAQs Section */}
        {activeTab === 'faqs' && (
          <div className="glass-panel fade-in" style={{ padding: '30px', textAlign: 'left' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', color: 'var(--primary)' }}>
              {lang === 'hi' ? 'सामान्यतः पूछे जाने वाले प्रश्न' : 'Frequently Asked Questions (FAQs)'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-primary)' }}>
                  {lang === 'hi' ? '1. मैं शिकायत कैसे दर्ज करूं?' : '1. How do I register a grievance?'}
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {lang === 'hi' 
                    ? 'शीर्ष मेनू में "शिकायत दर्ज करें" बटन पर क्लिक करें। विवरण दर्ज करें जैसे समस्या श्रेणी, भौतिक स्थान, विवरण और वैकल्पिक सहायक चित्र। अंत में, सबमिट करें।'
                    : 'Simply navigate to the "Submit Grievance" tab, enter details like the issue category, location details, a clear description, and upload optional photos before pressing Submit.'}
                </p>
              </div>

              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-primary)' }}>
                  {lang === 'hi' ? '2. जमा करने के बाद क्या होता है?' : '2. What happens after submission?'}
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {lang === 'hi' 
                    ? 'आपकी शिकायत को संदर्भ आईडी दी जाएगी। एक विभाग समन्वयक शिकायत की समीक्षा करेगा, एक अधिकारी नियुक्त करेगा और समस्या हल होने के बाद स्थिति को "समाधान" में बदल देगा।'
                    : 'Your grievance is registered with a unique numeric Reference ID. A department coordinator reviews it, assigns it to a field officer, and updates its status to In Progress and ultimately Resolved.'}
                </p>
              </div>

              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-primary)' }}>
                  {lang === 'hi' ? '3. मैं अपनी शिकायत को कैसे ट्रैक करूं?' : '3. How can I track my grievance?'}
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {lang === 'hi' 
                    ? 'शीर्ष मेनू में "शिकायत ट्रैक करें" पर जाएं, अपनी संदर्भ संख्या (उदा. 90001) दर्ज करें और "ट्रैक" पर क्लिक करें। यह आपको प्रगति समयरेखा दिखाएगा।'
                    : 'Go to the "Track Grievance" tab, input your numeric Reference ID, and click search. A detailed horizontal progress timeline will illustrate the lifecycle stage.'}
                </p>
              </div>

              <div style={{ paddingBottom: '15px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-primary)' }}>
                  {lang === 'hi' ? '4. शिकायत निवारण की अधिकतम समय सीमा क्या है?' : '4. What is the SLA for resolution?'}
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {lang === 'hi' 
                    ? 'सरकारी दिशानिर्देशों के अनुसार, जन शिकायतों का निवारण 30 दिनों के भीतर किया जाना चाहिए। तत्काल/महत्वपूर्ण समस्याओं को पहले प्राथमिकता दी जाती है।'
                    : 'As per central government guidelines, public grievances are aimed to be resolved within 30 days. High/Critical urgency settings receive expedited priority reviews.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 0d: Contact Us Section */}
        {activeTab === 'contact' && (
          <div className="glass-panel fade-in" style={{ padding: '30px', textAlign: 'left' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: 'var(--primary)' }}>
              {lang === 'hi' ? 'शिकायत निवारण अधिकारी और सहायता डेस्क' : 'Grievance Officers & Helpdesk'}
            </h2>
            <p style={{ margin: '0 0 25px 0', color: 'var(--text-secondary)', fontSize: '15px' }}>
              {lang === 'hi' ? 'किसी भी तकनीकी कठिनाई या प्रशासनिक पूछताछ के लिए DARPG कार्यालय से संपर्क करें।' : 'Contact the DARPG offices or the technical commission desk for queries related to public filing.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', marginBottom: '20px' }}>
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>{lang === 'hi' ? '📍 मुख्य प्रशासनिक कार्यालय' : '📍 Administrative HQ'}</h4>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Department of Administrative Reforms & Public Grievances (DARPG)<br />
                  Sardar Patel Bhavan, Sansad Marg,<br />
                  New Delhi, Delhi - 110001
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>{lang === 'hi' ? '📞 राष्ट्रीय हेल्पलाइन' : '📞 National Helpline'}</h4>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  <strong>{lang === 'hi' ? 'टोल-फ्री नंबर' : 'Toll-Free Helpline'}:</strong> 1800-11-4560<br />
                  <strong>{lang === 'hi' ? 'मुख्य सहायता केंद्र' : 'Central PG Helpdesk'}:</strong> +91-11-23742111<br />
                  <strong>{lang === 'hi' ? 'कार्यालय समय' : 'Hours'}:</strong> 9:00 AM - 5:30 PM (Mon-Fri)
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>{lang === 'hi' ? '📧 आधिकारिक ईमेल' : '📧 Electronic Support'}</h4>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  <strong>{lang === 'hi' ? 'तकनीकी सहायता' : 'Technical Desk'}:</strong> support-darpg@nic.in<br />
                  <strong>{lang === 'hi' ? 'सार्वजनिक शिकायत अधिकारी' : 'Grievance Officer'}:</strong> director-pg@nic.in<br />
                  <strong>{lang === 'hi' ? 'प्रतिक्रिया' : 'Feedback Desk'}:</strong> feedback-darpg@gov.in
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 0e: Feedback Form or Administrative Feedback List */}
        {activeTab === 'feedback' && (
          <div className="glass-panel fade-in" style={{ padding: '30px', textAlign: 'left' }}>
            {user.is_admin ? (
              <>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: 'var(--primary)' }}>
                  {lang === 'hi' ? 'नागरिक प्रतिक्रिया लॉग' : 'Citizen Feedback Log'}
                </h2>
                <p style={{ margin: '0 0 25px 0', color: 'var(--text-secondary)', fontSize: '15px' }}>
                  {lang === 'hi' ? 'पोर्टल प्रदर्शन और उपयोगिता पर नागरिकों द्वारा दी गई प्रतिक्रिया देखें।' : 'Monitor usability feedback and rating averages submitted by the portal users.'}
                </p>

                {loadingFeedbacks ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {lang === 'hi' ? 'प्रतिक्रियाएं लोड की जा रही हैं...' : 'Loading feedback logs...'}
                  </p>
                ) : feedbacksList.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '15px' }}>
                    {lang === 'hi' ? 'कोई प्रतिक्रिया दर्ज नहीं की गई है।' : 'No feedbacks have been submitted yet.'}
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', background: 'var(--bg-surface)' }}>
                      <thead>
                        <tr style={{ background: 'rgba(30, 58, 138, 0.05)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', textAlign: 'left' }}>
                          <th style={{ padding: '12px 16px' }}>{lang === 'hi' ? 'नागरिक' : 'Citizen'}</th>
                          <th style={{ padding: '12px 16px' }}>{lang === 'hi' ? 'प्रकार' : 'Feedback Type'}</th>
                          <th style={{ padding: '12px 16px' }}>{lang === 'hi' ? 'रेटिंग' : 'Rating'}</th>
                          <th style={{ padding: '12px 16px' }}>{lang === 'hi' ? 'सुझाव और टिप्पणियां' : 'Comments & Suggestions'}</th>
                          <th style={{ padding: '12px 16px' }}>{lang === 'hi' ? 'दिनांक' : 'Submitted On'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feedbacksList.map(fb => (
                          <tr key={fb.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }} className="table-row-hover">
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                              {fb.user_name}<br />
                              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>{fb.user_email}</span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ background: 'rgba(217, 119, 6, 0.1)', color: 'var(--secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                                {fb.feedback_type}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#fbbf24', fontSize: '15px' }}>
                              {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                            </td>
                            <td style={{ padding: '12px 16px', lineHeight: '1.4' }}>{fb.comments}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                              {new Date(fb.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', color: 'var(--primary)' }}>
                  {lang === 'hi' ? 'पोर्टल उपयोगिता प्रतिक्रिया' : 'Portal Usability Feedback'}
                </h2>
                <p style={{ margin: '0 0 25px 0', color: 'var(--text-muted)', fontSize: '14.5px' }}>
                  {lang === 'hi' 
                    ? 'हम लोक निवारण पोर्टल को लगातार बेहतर बनाने का प्रयास करते हैं। कृपया अपना बहुमूल्य सुझाव और रेटिंग यहाँ दर्ज करें।'
                    : 'We continuously improve the Lok Nivaran Portal. Share your experience, interface ratings, or suggestions below.'}
                </p>

                {feedbackSuccess && (
                  <div className="glass-panel" style={{ padding: '15px 20px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--status-resolved-border)', color: 'var(--status-resolved-text)', borderRadius: '6px', marginBottom: '20px', fontWeight: 600 }}>
                    ✓ {feedbackSuccess}
                  </div>
                )}

                <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {lang === 'hi' ? 'प्रतिक्रिया की श्रेणी' : 'Feedback Category'}
                    </label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="form-input custom-select"
                      required
                    >
                      <option value="Ease of Use">{lang === 'hi' ? 'उपयोग में आसानी (Ease of Use)' : 'Ease of Use'}</option>
                      <option value="Portal Performance">{lang === 'hi' ? 'पोर्टल प्रदर्शन (Portal Performance)' : 'Portal Performance'}</option>
                      <option value="Resolution Quality">{lang === 'hi' ? 'निवारण गुणवत्ता (Resolution Quality)' : 'Resolution Quality'}</option>
                      <option value="AI Suggestions Accuracy">{lang === 'hi' ? 'एआई सुझाव सटीकता (AI Accuracy)' : 'AI Suggestions Accuracy'}</option>
                      <option value="Other">{lang === 'hi' ? 'अन्य विषय (Other)' : 'Other'}</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                      {lang === 'hi' ? 'पोर्टल रेटिंग' : 'Portal Rating'}
                    </label>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '28px', cursor: 'pointer' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <span 
                          key={star} 
                          onClick={() => setFeedbackRating(star)} 
                          style={{ color: star <= feedbackRating ? '#fbbf24' : 'var(--border-color)', transition: 'color 0.2s' }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      {lang === 'hi' ? 'टिप्पणियां और सुझाव' : 'Comments & Suggestions'}
                    </label>
                    <textarea
                      value={feedbackComments}
                      onChange={(e) => setFeedbackComments(e.target.value)}
                      placeholder={lang === 'hi' ? 'कृपया अपनी प्रतिक्रिया विस्तार से लिखें...' : 'Describe your experience or suggest improvements...'}
                      required
                      className="form-input"
                      rows={5}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={submittingFeedback}
                    style={{ padding: '12px', fontSize: '15px', fontWeight: '600' }}
                  >
                    {submittingFeedback 
                      ? (lang === 'hi' ? 'जमा किया जा रहा है...' : 'Submitting Feedback...') 
                      : (lang === 'hi' ? 'प्रतिक्रिया सबमिट करें' : 'Submit Feedback')}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Submit Grievance (Users Only) */}
        {!user.is_admin && activeTab === 'submit' && (
          <div className="glass-panel fade-in" style={styles.formCard}>
            <div style={styles.formHeader}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>File a New Grievance</h2>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                State your concern. GrievanceFlow AI will analyze your report to instantly catalog and prioritize it.
              </p>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  placeholder="Enter location (e.g. Room 3B, Ward 4, Block A)"
                  value={newGrievance.location}
                  onChange={(e) => setNewGrievance({ ...newGrievance, location: e.target.value })}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="description">Issue Description</label>
                <textarea
                  id="description"
                  placeholder="Describe your grievance in detail. E.g., 'The ceiling AC unit in conference room 3B is leaking water onto the table, causing electrical safety concerns...'"
                  value={newGrievance.description}
                  onChange={(e) => setNewGrievance({ ...newGrievance, description: e.target.value })}
                  onBlur={handleDescriptionBlur}
                  required
                  style={styles.textarea}
                  className="form-input"
                  rows="5"
                />
                <div style={styles.textareaFooter}>
                  <span style={styles.charCount}>
                    {newGrievance.description.length} characters
                  </span>
                  
                  {newGrievance.description.trim().length >= 10 && (
                    <button
                      type="button"
                      onClick={() => triggerAiClassification(newGrievance.description)}
                      style={styles.aiTagBtn}
                      disabled={isAiClassifying}
                    >
                      <svg className={isAiClassifying ? "spin" : "sparkle-pulse"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--secondary)' }}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span>{isAiClassifying ? 'Analyzing...' : 'Run AI Tagger'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="image">Attach Image (Optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="form-input"
                    style={{ padding: '8px' }}
                  />
                  {imagePreview && (
                    <div style={{ position: 'relative', width: 'fit-content', marginTop: '10px' }}>
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border)' }} 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview('');
                          document.getElementById('image').value = '';
                        }}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: 'rgba(239, 68, 68, 0.9)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold',
                        }}
                        title="Remove Image"
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Auto-tagging Shimmer Loading state */}
              {isAiClassifying && (
                <div style={styles.aiLoadingBox} className="shimmer">
                  <div style={styles.aiLoadingSpinner}></div>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>AI is tagging your grievance based on keywords and description severity...</span>
                </div>
              )}

              {/* AI Suggestions Display panel */}
              {aiTagResult && !isAiClassifying && (
                <div style={styles.aiResultPanel} className="fade-in">
                  <div style={styles.aiResultHeader}>
                    <svg className="sparkle-pulse" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--secondary)' }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span style={styles.aiResultTitle}>GrievanceFlow AI Auto-Tag Successful</span>
                  </div>
                  <p style={{ margin: '4px 0 12px 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                    Based on your description, the following parameters have been auto-populated. Feel free to adjust them if they require corrections.
                  </p>
                  <div style={styles.aiResultTags}>
                    <div style={styles.aiTagValue}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>CATEGORY</span>
                      <strong style={{ color: '#ffffff' }}>{aiTagResult.category}</strong>
                    </div>
                    <div style={styles.aiTagValue}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>URGENCY</span>
                      <strong style={{ 
                        color: aiTagResult.urgency === 'Critical' ? '#f87171' : 
                               aiTagResult.urgency === 'High' ? '#fb923c' : 
                               aiTagResult.urgency === 'Medium' ? '#22d3ee' : '#9ca3af' 
                      }}>{aiTagResult.urgency}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Classification Select Fields */}
              <div style={styles.formRow}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" htmlFor="category">
                    Category 
                    {hasTappedAi && <span style={styles.aiApplied}>• AI Selected</span>}
                  </label>
                  <select
                    id="category"
                    value={newGrievance.category}
                    onChange={(e) => setNewGrievance({ ...newGrievance, category: e.target.value })}
                    required
                    className="form-input custom-select"
                  >
                    <option value="" disabled>Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" htmlFor="urgency">
                    Urgency Priority
                    {hasTappedAi && <span style={styles.aiApplied}>• AI Selected</span>}
                  </label>
                  <select
                    id="urgency"
                    value={newGrievance.urgency}
                    onChange={(e) => setNewGrievance({ ...newGrievance, urgency: e.target.value })}
                    className="form-input custom-select"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting || isAiClassifying}
                style={{ alignSelf: 'flex-end', padding: '12px 28px', marginTop: '10px' }}
              >
                {submitting ? (
                  <div style={styles.loadingSpinner}></div>
                ) : (
                  <>
                    <span>Submit Grievance</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Grievance List (User own / Admin queue) */}
        {((!user.is_admin && activeTab === 'list') || (user.is_admin && activeTab === 'queue')) && (
          <div className="fade-in">
            {filteredGrievances.length === 0 ? (
              <div className="glass-panel" style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>No Grievances Found</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '360px' }}>
                  {grievances.length === 0 
                    ? (user.is_admin ? "No grievances have been registered in the system yet." : "You have not submitted any grievances yet.")
                    : "No grievances match the search query or filter tags."}
                </p>
                {!user.is_admin && grievances.length === 0 && (
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setActiveTab('submit')}
                    style={{ marginTop: '20px' }}
                  >
                    Submit Your First Issue
                  </button>
                )}
              </div>
            ) : (
              /* Desktop Layout: Sleek custom table | Mobile Layout: Dynamic Card List */
              <>
                {/* Desktop View */}
                <div style={styles.desktopTableWrapper} className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Ref ID</th>
                        {showAdminQueue && <th>Submitting User</th>}
                        <th style={{ width: '150px' }}>Category</th>
                        <th style={{ width: '150px' }}>Location</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Image</th>
                        <th>Issue Description</th>
                        <th style={{ width: '110px' }}>Urgency</th>
                        <th style={{ width: '140px' }}>Status</th>
                        {showAdminQueue && <th style={{ width: '150px' }}>Assigned To</th>}
                        <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrievances.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>#{item.id}</td>
                          {showAdminQueue && (
                            <td>
                              <div style={styles.tableUser}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>{item.user_name}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.user_email}</span>
                              </div>
                            </td>
                          )}
                          <td>
                            <div style={styles.tableCategory}>
                              <span style={styles.categoryDot}></span>
                              <span>{item.category || 'General Inquiry'}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                              {item.location || 'N/A'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.image_url ? (
                              <a href={item.image_url} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={item.image_url} 
                                  alt="Attachment" 
                                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} 
                                />
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None</span>
                            )}
                          </td>
                          <td style={styles.tableDescriptionCell}>
                            <p style={styles.tableDescriptionText} title={item.description}>
                              {item.description}
                            </p>
                            <span style={styles.tableTimestamp}>
                              Submitted {new Date(item.created_at || Date.now()).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              item.urgency === 'Critical' ? 'badge-urgency-critical' :
                              item.urgency === 'High' ? 'badge-urgency-high' :
                              item.urgency === 'Medium' ? 'badge-urgency-medium' : 'badge-urgency-low'
                            }`}>
                              {item.urgency || 'Low'}
                            </span>
                          </td>
                          <td>
                            {showAdminQueue ? (
                              <div style={styles.selectWrapper}>
                                <select
                                  value={item.status}
                                  onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                  style={{
                                    ...styles.statusSelectAdmin,
                                    color: 
                                      item.status === 'resolved' ? 'var(--status-resolved-text)' :
                                      item.status === 'in-progress' ? 'var(--status-progress-text)' :
                                      'var(--status-pending-text)',
                                    background:
                                      item.status === 'resolved' ? 'var(--status-resolved-bg)' :
                                      item.status === 'in-progress' ? 'var(--status-progress-bg)' :
                                      'var(--status-pending-bg)',
                                    borderColor:
                                      item.status === 'resolved' ? 'var(--status-resolved-border)' :
                                      item.status === 'in-progress' ? 'var(--status-progress-border)' :
                                      'var(--status-pending-border)',
                                  }}
                                  className="form-input custom-select"
                                >
                                  <option value="submitted" style={styles.optionPending}>Submitted</option>
                                  <option value="in-progress" style={styles.optionProgress}>In Progress</option>
                                  <option value="resolved" style={styles.optionResolved}>Resolved</option>
                                </select>
                              </div>
                            ) : (
                              <span className={`badge ${
                                item.status === 'resolved' ? 'badge-status-resolved' :
                                item.status === 'in-progress' ? 'badge-status-inprogress' :
                                'badge-status-submitted'
                              }`}>
                                {item.status === 'submitted' ? 'Submitted' :
                                 item.status === 'in-progress' ? 'In Progress' : 'Resolved'}
                              </span>
                            )}
                          </td>
                          {showAdminQueue && (
                            <td>
                              <input 
                                type="text" 
                                placeholder="Unassigned"
                                defaultValue={item.assigned_to || ''}
                                onBlur={(e) => handleAssigneeChange(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAssigneeChange(item.id, e.target.value);
                                    e.target.blur();
                                  }
                                }}
                                style={styles.assignInput}
                              />
                            </td>
                          )}
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => handleDelete(item.id)} 
                              className="btn btn-danger"
                              style={styles.deleteTableBtn}
                              title="Delete Grievance"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Card Grid View */}
                <div style={styles.mobileCardWrapper} className="cards-grid">
                  {filteredGrievances.map((item) => (
                    <div key={item.id} className="glass-panel fade-in" style={styles.mobCard}>
                      <div style={styles.mobCardHeader}>
                        <span style={styles.mobRefId}>Ref #{item.id}</span>
                        <div style={styles.mobBadges}>
                          <span className={`badge ${
                            item.urgency === 'Critical' ? 'badge-urgency-critical' :
                            item.urgency === 'High' ? 'badge-urgency-high' :
                            item.urgency === 'Medium' ? 'badge-urgency-medium' : 'badge-urgency-low'
                          }`}>
                            {item.urgency || 'Low'}
                          </span>
                          {!showAdminQueue && (
                            <span className={`badge ${
                              item.status === 'resolved' ? 'badge-status-resolved' :
                              item.status === 'in-progress' ? 'badge-status-inprogress' :
                              'badge-status-submitted'
                            }`}>
                              {item.status === 'submitted' ? 'Submitted' :
                               item.status === 'in-progress' ? 'In Progress' : 'Resolved'}
                            </span>
                          )}
                        </div>
                      </div>

                      {showAdminQueue && (
                        <div style={styles.mobUserLabel}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>{item.user_name} ({item.user_email})</span>
                        </div>
                      )}

                      <div style={styles.mobCategoryBlock}>
                        <span style={styles.categoryDot}></span>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{item.category || 'General Inquiry'}</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 10px 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>Location: <strong style={{ color: 'var(--text-primary)' }}>{item.location || 'N/A'}</strong></span>
                      </div>

                      {item.image_url && (
                        <div style={{ margin: '0 0 12px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <a href={item.image_url} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={item.image_url} 
                              alt="Attachment" 
                              style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }} 
                            />
                          </a>
                        </div>
                      )}

                      <p style={styles.mobDesc}>{item.description}</p>
                      
                      <div style={styles.mobTimestampBlock}>
                        Submitted {new Date(item.created_at || Date.now()).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>

                      {/* Mob Card Footer Actions */}
                      <div style={styles.mobCardFooter}>
                        {showAdminQueue ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Status</label>
                              <select
                                value={item.status}
                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                style={{
                                  ...styles.statusSelectAdminMob,
                                  color: 
                                    item.status === 'resolved' ? 'var(--status-resolved-text)' :
                                    item.status === 'in-progress' ? 'var(--status-progress-text)' :
                                    'var(--status-pending-text)',
                                  background:
                                    item.status === 'resolved' ? 'var(--status-resolved-bg)' :
                                    item.status === 'in-progress' ? 'var(--status-progress-bg)' :
                                    'var(--status-pending-bg)',
                                  borderColor:
                                    item.status === 'resolved' ? 'var(--status-resolved-border)' :
                                    item.status === 'in-progress' ? 'var(--status-progress-border)' :
                                    'var(--status-pending-border)',
                                }}
                                className="form-input custom-select"
                              >
                                <option value="submitted">Submitted</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Assigned To</label>
                              <input 
                                type="text" 
                                placeholder="Unassigned"
                                defaultValue={item.assigned_to || ''}
                                onBlur={(e) => handleAssigneeChange(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAssigneeChange(item.id, e.target.value);
                                    e.target.blur();
                                  }
                                }}
                                style={styles.assignInput}
                              />
                            </div>
                          </div>
                        ) : null}

                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="btn btn-danger"
                          style={{
                            ...styles.deleteMobBtn,
                            flex: user.is_admin ? 'none' : '1'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          {!user.is_admin && <span>Delete Report</span>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Official Government Footer */}
      <footer className="gov-footer" style={{ marginTop: '40px' }}>
        <div className="footer-grid">
          <div className="footer-column">
            <h5 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '15px' }}>
              {lang === 'hi' ? 'नीति व नियम' : 'Policy & Rules'}
            </h5>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>{lang === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy'}</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>{lang === 'hi' ? 'नियम और शर्तें' : 'Terms & Conditions'}</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>{lang === 'hi' ? 'हाइपरलिंकिंग नीति' : 'Hyperlinking Policy'}</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>{lang === 'hi' ? 'कॉपीराइट नीति' : 'Copyright Policy'}</a></li>
            </ul>
          </div>
          
          <div className="footer-column">
            <h5 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '15px' }}>
              {lang === 'hi' ? 'महत्वपूर्ण कड़ियाँ' : 'Important Links'}
            </h5>
            <ul className="footer-links">
              <li><a href="https://darpg.gov.in" target="_blank" rel="noopener noreferrer">DARPG Website</a></li>
              <li><a href="https://pgportal.gov.in" target="_blank" rel="noopener noreferrer">CPGRAMS Portal</a></li>
              <li><a href="https://india.gov.in" target="_blank" rel="noopener noreferrer">National Portal of India</a></li>
              <li><a href="https://mygov.in" target="_blank" rel="noopener noreferrer">MyGov Platform</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h5 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '15px' }}>
              {lang === 'hi' ? 'सहायता डेस्क' : 'Help & Support'}
            </h5>
            <ul className="footer-links">
              <li><a href="#" onClick={() => setActiveTab('faqs')}>{lang === 'hi' ? 'सामान्य प्रश्न (FAQs)' : 'FAQs & Guides'}</a></li>
              <li><a href="#" onClick={() => setActiveTab('contact')}>{lang === 'hi' ? 'हमसे संपर्क करें' : 'Contact Support'}</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>{lang === 'hi' ? 'साइट मैप' : 'Sitemap'}</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('feedback'); }}>{lang === 'hi' ? 'फीडबैक' : 'Feedback Form'}</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            {lang === 'hi' 
              ? '© 2026 प्रशासनिक सुधार और लोक शिकायत विभाग, भारत सरकार। सर्वाधिकार सुरक्षित।' 
              : '© 2026 Department of Administrative Reforms & Public Grievances, Government of India. All rights reserved.'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Website Version 2.4.0 (SAMADHAN) • e-Governance Commission
          </span>
        </div>
      </footer>
      </div> {/* Closing scrollContainer */}
      </div> {/* Closing contentWrapper */}
    </div>
  );
}

const styles = {
  dashboardContainer: {
    width: '100vw',
    height: '100vh',
    boxSizing: 'border-box',
    padding: '36px 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg-base)',
    position: 'relative',
  },
  contentWrapper: {
    width: '100%',
    padding: '16px 24px 20px 24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
    gap: '16px',
    minHeight: 0,
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: 0,
    paddingRight: '6px',
  },
  emblemWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
  },
  subNavbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0 20px',
    marginTop: '-12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  subNavLinks: {
    display: 'flex',
    gap: '15px',
  },
  subNavLink: {
    background: 'none',
    border: 'none',
    padding: '16px 12px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 28px',
    borderRadius: '8px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    background: 'var(--primary)',
    color: '#ffffff',
    boxShadow: '0 2px 4px var(--primary-glow)',
  },
  navTitle: {
    fontSize: '18px',
    fontFamily: 'var(--font-heading)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  navUserSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'var(--primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '15px',
    border: '2px solid var(--border-color)',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    '@media (max-width: 640px)': {
      display: 'none',
    }
  },
  userName: {
    fontSize: '14.5px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  userRole: {
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginTop: '1px',
  },
  logoutBtn: {
    padding: '8px 14px',
    fontSize: '13px',
    gap: '6px',
  },
  logoutText: {
    '@media (max-width: 640px)': {
      display: 'none',
    }
  },
  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--primary)',
    padding: '12px 20px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
    zIndex: 100,
    color: 'var(--text-primary)',
    fontWeight: 500,
    fontSize: '14px',
  },
  toastTick: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'var(--status-resolved-bg)',
    color: 'var(--status-resolved-text)',
    border: '1px solid var(--status-resolved-border)',
  },
  statsSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  statCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    background: 'var(--bg-surface)',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  statInfo: {
    textAlign: 'left',
  },
  statLabel: {
    margin: 0,
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statVal: {
    margin: '4px 0 0 0',
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-heading)',
  },
  statIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '10px',
  },
  mainLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    textAlign: 'left',
  },
  tabBarContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-color)',
  },
  tabNav: {
    display: 'flex',
    gap: '10px',
  },
  tabButton: {
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    gap: '8px',
  },
  filterControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  searchInput: {
    padding: '8px 12px 8px 36px',
    fontSize: '13.5px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '200px',
    transition: 'all 0.2s',
    '&:focus': {
      borderColor: 'var(--primary)',
      width: '240px',
    }
  },
  dropdownFilters: {
    display: 'flex',
    gap: '10px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterLabel: {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
  filterSelect: {
    padding: '7px 32px 7px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    width: 'auto',
  },
  errorText: {
    color: '#f87171',
    background: 'rgba(239, 68, 68, 0.08)',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    fontSize: '14px',
    margin: 0,
  },
  formCard: {
    padding: '32px',
    background: 'var(--bg-surface)',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  formHeader: {
    marginBottom: '24px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '16px',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    fontFamily: 'var(--font-sans)',
    lineHeight: '1.5',
    boxSizing: 'border-box',
  },
  textareaFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
  },
  charCount: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  aiTagBtn: {
    background: 'var(--secondary-glow)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    color: 'var(--secondary-hover)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    '&:hover': {
      background: 'rgba(6, 182, 212, 0.25)',
      transform: 'translateY(-1px)',
    }
  },
  aiLoadingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderRadius: '10px',
    border: '1px dashed rgba(6, 182, 212, 0.3)',
    color: '#22d3ee',
  },
  aiLoadingSpinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(6, 182, 212, 0.2)',
    borderTop: '2px solid #22d3ee',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  aiResultPanel: {
    background: 'rgba(6, 182, 212, 0.05)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    borderRadius: '12px',
    padding: '18px 22px',
  },
  aiResultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  aiResultTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  aiResultTags: {
    display: 'flex',
    gap: '16px',
  },
  aiTagValue: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-base)',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    minWidth: '120px',
    textAlign: 'left',
    gap: '2px',
  },
  formRow: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  aiApplied: {
    color: 'var(--secondary)',
    fontSize: '11px',
    fontWeight: '700',
    marginLeft: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  loadingSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyState: {
    padding: '48px 32px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
  },
  emptyIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    background: 'var(--bg-base)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    border: '1px solid var(--border-color)',
  },
  desktopTableWrapper: {
    '@media (max-width: 860px)': {
      display: 'none',
    }
  },
  tableUser: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableCategory: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  categoryDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--primary)',
    boxShadow: '0 0 6px var(--primary-glow)',
  },
  tableDescriptionCell: {
    maxWidth: '320px',
  },
  tableDescriptionText: {
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  tableTimestamp: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '3px',
    display: 'block',
  },
  selectWrapper: {
    position: 'relative',
    display: 'inline-block',
    width: '100%',
  },
  statusSelectAdmin: {
    fontSize: '12.5px',
    fontWeight: '700',
    padding: '6px 28px 6px 12px',
    borderRadius: '8px',
    width: '100%',
    cursor: 'pointer',
    outline: 'none',
    border: '1px solid transparent',
  },
  assignInput: {
    padding: '6px 10px',
    fontSize: '13px',
    borderRadius: '6px',
    background: 'var(--bg-base)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    width: '100%',
    boxSizing: 'border-box',
  },
  optionPending: { background: '#1e1b4b', color: '#fbbf24' },
  optionProgress: { background: '#1e3a8a', color: '#60a5fa' },
  optionResolved: { background: '#064e3b', color: '#34d399' },
  optionRejected: { background: '#4c0519', color: '#f87171' },
  deleteTableBtn: {
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.1)',
  },
  mobileCardWrapper: {
    display: 'none',
    '@media (max-width: 860px)': {
      display: 'grid',
    }
  },
  mobCard: {
    padding: '20px',
    background: 'rgba(17, 24, 39, 0.45)',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
  },
  mobCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobRefId: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  mobBadges: {
    display: 'flex',
    gap: '8px',
  },
  mobUserLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.15)',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  },
  mobCategoryBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '2px',
  },
  mobDesc: {
    fontSize: '14px',
    color: '#ffffff',
    lineHeight: '1.45',
    margin: 0,
  },
  mobTimestampBlock: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  mobCardFooter: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '6px',
    gap: '10px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '12px',
  },
  statusSelectAdminMob: {
    fontSize: '12px',
    fontWeight: '700',
    padding: '8px 28px 8px 12px',
    borderRadius: '8px',
    width: '100%',
    cursor: 'pointer',
    border: '1px solid transparent',
  },
  deleteMobBtn: {
    fontSize: '12px',
    padding: '8px 14px',
    gap: '6px',
  }
};