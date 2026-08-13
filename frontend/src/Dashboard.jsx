import { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api';

export default function Dashboard({ user, onLogout }) {
  const [grievances, setGrievances] = useState([]);
  const [activeTab, setActiveTab] = useState(user.is_admin ? 'queue' : 'list');
  const [newGrievance, setNewGrievance] = useState({ category: '', description: '', urgency: 'Low' });
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [urgencyFilter, setUrgencyFilter] = useState('All');

  // AI Tagging States
  const [isAiClassifying, setIsAiClassifying] = useState(false);
  const [aiTagResult, setAiTagResult] = useState(null);
  const [hasTappedAi, setHasTappedAi] = useState(false);

  // General States
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Refs for tracking changes
  const lastClassifiedText = useRef('');

  // Categories list
  const categories = [
    'IT Support',
    'Facilities',
    'Human Resources',
    'Finance & Billing',
    'Academic / Coursework',
    'General Inquiry'
  ];

  const loadGrievances = async () => {
    try {
      setError('');
      const data = await apiFetch('/grievances');
      setGrievances(data);
    } catch (err) {
      setError(err.message || 'Failed to load grievances.');
    }
  };

  useEffect(() => {
    loadGrievances();
  }, []);

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

    setSubmitting(true);
    try {
      await apiFetch('/grievances', {
        method: 'POST',
        body: JSON.stringify({
          description: newGrievance.description,
          category: newGrievance.category || 'General Inquiry',
          urgency: newGrievance.urgency || 'Low'
        }),
      });
      
      // Reset form
      setNewGrievance({ category: '', description: '', urgency: 'Low' });
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
    pending: grievances.filter(g => g.status === 'Pending').length,
    inProgress: grievances.filter(g => g.status === 'In Progress').length,
    resolved: grievances.filter(g => g.status === 'Resolved').length,
    critical: grievances.filter(g => g.urgency === 'Critical' || g.urgency === 'High').length,
  };

  return (
    <div style={styles.dashboardContainer} className="fade-in">
      {/* Top Navbar */}
      <header style={styles.navbar} className="glass-panel">
        <div style={styles.navLogo}>
          <div style={styles.logoBadge}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span style={styles.navTitle}>GrievanceFlow <span style={styles.aiTag}>AI</span></span>
        </div>

        <div style={styles.navUserSection}>
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
                {user.is_admin ? 'Administrative Coordinator' : 'General User'}
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

      {/* KPI Cards section */}
      <section style={styles.statsSection}>
        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>{user.is_admin ? 'Total Grievances' : 'My Filings'}</h4>
            <p style={styles.statVal}>{stats.total}</p>
          </div>
          <div style={{ ...styles.statIcon, background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
        </div>

        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>Pending Action</h4>
            <p style={styles.statVal}>{stats.pending}</p>
          </div>
          <div style={{ ...styles.statIcon, background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-pending-text)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>

        <div className="glass-panel" style={styles.statCard}>
          <div style={styles.statInfo}>
            <h4 style={styles.statLabel}>In Progress</h4>
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
            <h4 style={styles.statLabel}>Priority Issues</h4>
            <p style={{ ...styles.statVal, color: stats.critical > 0 ? '#f87171' : 'var(--text-primary)' }}>{stats.critical}</p>
          </div>
          <div style={{ 
            ...styles.statIcon, 
            background: stats.critical > 0 ? 'rgba(220, 38, 38, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: stats.critical > 0 ? '#f87171' : 'var(--text-muted)' 
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>
      </section>

      {/* Main Tab Navigation & Controls */}
      <div style={styles.mainLayout}>
        <div style={styles.tabBarContainer}>
          <div style={styles.tabNav}>
            {user.is_admin ? (
              <button 
                className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('queue')}
                style={styles.tabButton}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                </svg>
                <span>Grievance Queue</span>
              </button>
            ) : (
              <>
                <button 
                  className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('list')}
                  style={styles.tabButton}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span>My Grievances</span>
                </button>
                <button 
                  className={`btn ${activeTab === 'submit' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('submit')}
                  style={styles.tabButton}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>File a Grievance</span>
                </button>
              </>
            )}
          </div>

          {/* Filtering Controls (Only shown for list/queue tabs) */}
          {(activeTab === 'list' || activeTab === 'queue') && (
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
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
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
                        {user.is_admin && <th>Submitting User</th>}
                        <th style={{ width: '150px' }}>Category</th>
                        <th>Issue Description</th>
                        <th style={{ width: '110px' }}>Urgency</th>
                        <th style={{ width: '140px' }}>Status</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrievances.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>#{item.id}</td>
                          {user.is_admin && (
                            <td>
                              <div style={styles.tableUser}>
                                <strong style={{ color: '#ffffff', fontSize: '13.5px' }}>{item.user_name}</strong>
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
                            {user.is_admin ? (
                              <div style={styles.selectWrapper}>
                                <select
                                  value={item.status}
                                  onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                  style={{
                                    ...styles.statusSelectAdmin,
                                    color: 
                                      item.status === 'Resolved' ? 'var(--status-resolved-text)' :
                                      item.status === 'In Progress' ? 'var(--status-progress-text)' :
                                      item.status === 'Rejected' ? 'var(--status-rejected-text)' :
                                      'var(--status-pending-text)',
                                    background:
                                      item.status === 'Resolved' ? 'var(--status-resolved-bg)' :
                                      item.status === 'In Progress' ? 'var(--status-progress-bg)' :
                                      item.status === 'Rejected' ? 'var(--status-rejected-bg)' :
                                      'var(--status-pending-bg)',
                                    borderColor:
                                      item.status === 'Resolved' ? 'var(--status-resolved-border)' :
                                      item.status === 'In Progress' ? 'var(--status-progress-border)' :
                                      item.status === 'Rejected' ? 'var(--status-rejected-border)' :
                                      'var(--status-pending-border)',
                                  }}
                                  className="form-input custom-select"
                                >
                                  <option value="Pending" style={styles.optionPending}>Pending</option>
                                  <option value="In Progress" style={styles.optionProgress}>In Progress</option>
                                  <option value="Resolved" style={styles.optionResolved}>Resolved</option>
                                  <option value="Rejected" style={styles.optionRejected}>Rejected</option>
                                </select>
                              </div>
                            ) : (
                              <span className={`badge ${
                                item.status === 'Resolved' ? 'badge-status-resolved' :
                                item.status === 'In Progress' ? 'badge-status-inprogress' :
                                item.status === 'Rejected' ? 'badge-status-rejected' : 'badge-status-pending'
                              }`}>
                                {item.status || 'Pending'}
                              </span>
                            )}
                          </td>
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
                          {!user.is_admin && (
                            <span className={`badge ${
                              item.status === 'Resolved' ? 'badge-status-resolved' :
                              item.status === 'In Progress' ? 'badge-status-inprogress' :
                              item.status === 'Rejected' ? 'badge-status-rejected' : 'badge-status-pending'
                            }`}>
                              {item.status || 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>

                      {user.is_admin && (
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
                        {user.is_admin ? (
                          <div style={{ flex: 1, marginRight: '15px' }}>
                            <select
                              value={item.status}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              style={{
                                ...styles.statusSelectAdminMob,
                                color: 
                                  item.status === 'Resolved' ? 'var(--status-resolved-text)' :
                                  item.status === 'In Progress' ? 'var(--status-progress-text)' :
                                  item.status === 'Rejected' ? 'var(--status-rejected-text)' :
                                  'var(--status-pending-text)',
                                background:
                                  item.status === 'Resolved' ? 'var(--status-resolved-bg)' :
                                  item.status === 'In Progress' ? 'var(--status-progress-bg)' :
                                  item.status === 'Rejected' ? 'var(--status-rejected-bg)' :
                                  'var(--status-pending-bg)',
                                borderColor:
                                  item.status === 'Resolved' ? 'var(--status-resolved-border)' :
                                  item.status === 'In Progress' ? 'var(--status-progress-border)' :
                                  item.status === 'Rejected' ? 'var(--status-rejected-border)' :
                                  'var(--status-pending-border)',
                              }}
                              className="form-input custom-select"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
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
    </div>
  );
}

const styles = {
  dashboardContainer: {
    maxWidth: '1240px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 20px',
    boxSizing: 'border-box',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 28px',
    borderRadius: '16px',
    background: 'rgba(17, 24, 39, 0.45)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
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
    borderRadius: '8px',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
    color: '#ffffff',
    boxShadow: '0 4px 10px rgba(139, 92, 246, 0.25)',
  },
  navTitle: {
    fontSize: '18px',
    fontFamily: 'var(--font-heading)',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  aiTag: {
    color: 'var(--secondary)',
    fontWeight: '800',
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
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-pink) 100%)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '15px',
    border: '2px solid rgba(255, 255, 255, 0.08)',
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
    color: '#ffffff',
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
    background: '#111827',
    border: '1px solid var(--border-color-focus)',
    padding: '12px 20px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 10px var(--primary-glow)',
    zIndex: 100,
    color: '#ffffff',
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
    background: 'rgba(17, 24, 39, 0.4)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
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
    color: '#ffffff',
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
    background: 'rgba(17, 24, 39, 0.6)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: '#ffffff',
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
    borderRadius: '8px',
    background: 'rgba(17, 24, 39, 0.6)',
    border: '1px solid var(--border-color)',
    color: '#ffffff',
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
    background: 'rgba(17, 24, 39, 0.35)',
    borderRadius: '16px',
  },
  formHeader: {
    marginBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
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
    color: '#ffffff',
  },
  aiResultTags: {
    display: 'flex',
    gap: '16px',
  },
  aiTagValue: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0, 0, 0, 0.25)',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
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
    background: 'rgba(17, 24, 39, 0.2)',
  },
  emptyIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
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
    color: '#ffffff',
  },
  categoryDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--primary)',
    boxShadow: '0 0 6px var(--primary)',
  },
  tableDescriptionCell: {
    maxWidth: '320px',
  },
  tableDescriptionText: {
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#ffffff',
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