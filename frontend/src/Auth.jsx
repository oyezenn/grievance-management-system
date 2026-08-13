import { useState } from 'react';
import { apiFetch } from './api';

export default function Auth({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', is_admin: false });
  const [error, setError] = useState('');

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

    try {
      if (isRegister) {
        await apiFetch('/register', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        alert('Registration successful! Please log in.');
        setIsRegister(false);
      } else {
        const data = await apiFetch('/login', {
          method: 'POST',
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        {isRegister && (
          <div style={{ marginBottom: '10px' }}>
            <label>Name: </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            />
          </div>
        )}

        <div style={{ marginBottom: '10px' }}>
          <label>Email: </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Password: </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: '100%' }}
          />
        </div>

        {isRegister && (
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                name="is_admin"
                checked={formData.is_admin}
                onChange={handleChange}
              />
              {' '}Register as Admin
            </label>
          </div>
        )}

        <button type="submit" style={{ width: '100%', padding: '10px', marginTop: '10px' }}>
          {isRegister ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      <p
        style={{ marginTop: '15px', cursor: 'pointer', color: 'blue' }}
        onClick={() => setIsRegister(!isRegister)}
      >
        {isRegister ? 'Already have an account? Log in' : "Don't have an account? Register"}
      </p>
    </div>
  );
}