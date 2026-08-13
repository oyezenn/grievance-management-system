import { useState, useEffect } from 'react';
import { apiFetch } from './api';

export default function Dashboard({ user, onLogout }) {
  const [grievances, setGrievances] = useState([]);
  const [newGrievance, setNewGrievance] = useState({ category: '', description: '', urgency: 'Low' });
  const [error, setError] = useState('');

  const loadGrievances = async () => {
    try {
      const data = await apiFetch('/grievances');
      setGrievances(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadGrievances();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/grievances', {
        method: 'POST',
        body: JSON.stringify(newGrievance),
      });
      setNewGrievance({ category: '', description: '', urgency: 'Low' });
      loadGrievances();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await apiFetch(`/grievances/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadGrievances();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this grievance?')) return;
    try {
      await apiFetch(`/grievances/${id}`, { method: 'DELETE' });
      loadGrievances();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '20px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Welcome, {user.name} {user.is_admin ? '(Admin)' : ''}</h2>
        <button onClick={onLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
      </header>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Form to submit grievance (Regular Users Only) */}
      {!user.is_admin && (
        <form onSubmit={handleCreate} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
          <h3>File a Grievance</h3>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Category (e.g., IT Support, Facilities)"
              value={newGrievance.category}
              onChange={(e) => setNewGrievance({ ...newGrievance, category: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
            />
            <textarea
              placeholder="Description of issue..."
              value={newGrievance.description}
              onChange={(e) => setNewGrievance({ ...newGrievance, description: e.target.value })}
              required
              style={{ width: '100%', height: '80px', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
            />
            <select
              value={newGrievance.urgency}
              onChange={(e) => setNewGrievance({ ...newGrievance, urgency: e.target.value })}
              style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
            >
              <option value="Low">Low Urgency</option>
              <option value="Medium">Medium Urgency</option>
              <option value="High">High Urgency</option>
              <option value="Critical">Critical Urgency</option>
            </select>
          </div>
          <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>Submit Grievance</button>
        </form>
      )}

      {/* Grievances Table */}
      <h3>{user.is_admin ? 'All Submitted Grievances' : 'My Grievances'}</h3>
      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr>
            <th>ID</th>
            {user.is_admin && <th>User</th>}
            <th>Category</th>
            <th>Description</th>
            <th>Urgency</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {grievances.length === 0 ? (
            <tr>
              <td colSpan={user.is_admin ? 7 : 6} style={{ textAlign: 'center' }}>No grievances found.</td>
            </tr>
          ) : (
            grievances.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                {user.is_admin && <td>{item.user_name} ({item.user_email})</td>}
                <td>{item.category}</td>
                <td>{item.description}</td>
                <td>{item.urgency}</td>
                <td>
                  {user.is_admin ? (
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  ) : (
                    item.status
                  )}
                </td>
                <td>
                  <button onClick={() => handleDelete(item.id)} style={{ cursor: 'pointer', color: 'red' }}>Delete</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}