const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');
const { classifyGrievance } = require('./aiChain');

const app = express();
app.use(cors());
app.use(express.json());

// --- MIDDLEWARE ---

// Authenticate JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Check if User is Admin
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- AUTHENTICATION ROUTES ---

// 1. POST /api/register
app.post('/api/register', async (req, res) => {
  const { name, email, password, is_admin } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const isAdminVal = is_admin ? true : false;

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, isAdminVal]
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// 2. POST /api/login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: Boolean(user.is_admin) },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: Boolean(user.is_admin)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// --- GRIEVANCE CRUD ROUTES ---

// 2.5 POST /api/classify - Classify grievance description using LLM or local fallback
app.post('/api/classify', authenticateToken, async (req, res) => {
  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Description is required.' });
  }
  try {
    const aiTags = await classifyGrievance(description);
    res.json(aiTags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to classify description', details: error.message });
  }
});

// 3. POST /api/grievances - Create new grievance with Auto-Tagging
app.post('/api/grievances', authenticateToken, async (req, res) => {
  let { category, description, urgency } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required.' });
  }

  try {
    // Auto-tag missing category or urgency using LangChain
    if (!category || !urgency) {
      const aiTags = await classifyGrievance(description);
      category = category || aiTags.category;
      urgency = urgency || aiTags.urgency;
    }

    const [result] = await db.query(
      'INSERT INTO grievances (user_id, category, description, urgency) VALUES (?, ?, ?, ?)',
      [req.user.id, category, description, urgency]
    );

    res.status(201).json({
      message: 'Grievance submitted successfully.',
      grievanceId: result.insertId,
      autoTagged: { category, urgency }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit grievance', details: error.message });
  }
});

// 4. GET /api/grievances - Fetch grievances (User sees own, Admin sees all)
app.get('/api/grievances', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.is_admin) {
      query = `
        SELECT g.*, u.name AS user_name, u.email AS user_email 
        FROM grievances g 
        JOIN users u ON g.user_id = u.id 
        ORDER BY g.created_at DESC
      `;
    } else {
      query = 'SELECT * FROM grievances WHERE user_id = ? ORDER BY created_at DESC';
      params = [req.user.id];
    }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve grievances', details: error.message });
  }
});

// 5. GET /api/grievances/:id - Get single grievance
app.get('/api/grievances/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT g.*, u.name AS user_name, u.email AS user_email 
       FROM grievances g 
       JOIN users u ON g.user_id = u.id 
       WHERE g.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    const grievance = rows[0];
    if (!req.user.is_admin && grievance.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json(grievance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch grievance details', details: error.message });
  }
});

// 6. PATCH /api/grievances/:id/status - Update status or urgency (Admin Only)
app.patch('/api/grievances/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, urgency } = req.body;

  if (!status && !urgency) {
    return res.status(400).json({ error: 'At least one field (status or urgency) is required.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM grievances WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (urgency) {
      updates.push('urgency = ?');
      params.push(urgency);
    }

    params.push(id);

    await db.query(`UPDATE grievances SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Grievance updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update grievance', details: error.message });
  }
});

// 7. DELETE /api/grievances/:id - Delete grievance (Owner or Admin)
app.delete('/api/grievances/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT user_id FROM grievances WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    if (!req.user.is_admin && rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await db.query('DELETE FROM grievances WHERE id = ?', [id]);
    res.json({ message: 'Grievance deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete grievance', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await db.query('SELECT 1');
    console.log('Connected to TiDB MySQL database successfully!');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
});