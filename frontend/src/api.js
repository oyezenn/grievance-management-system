const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'An error occurred');
  }
  return data;
};