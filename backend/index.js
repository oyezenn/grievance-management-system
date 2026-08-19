const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const db = require('./db');
const { classifyGrievance } = require('./aiChain');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
app.post('/api/grievances', authenticateToken, upload.single('image'), async (req, res) => {
  let { category, description, urgency, location } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required.' });
  }

  if (!location || typeof location !== 'string' || !location.trim()) {
    return res.status(400).json({ error: 'Location is required.' });
  }

  const imageUrl = req.file
    ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    : null;

  try {
    // Auto-tag missing category or urgency using LangChain
    if (!category || !urgency) {
      const aiTags = await classifyGrievance(description);
      category = category || aiTags.category;
      urgency = urgency || aiTags.urgency;
    }

    const [result] = await db.query(
      'INSERT INTO grievances (user_id, category, description, urgency, location, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, category, description, urgency, location.trim(), imageUrl]
    );

    res.status(201).json({
      message: 'Grievance submitted successfully.',
      grievanceId: result.insertId,
      imageUrl: imageUrl,
      autoTagged: { category, urgency }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit grievance', details: error.message });
  }
});

// 4. GET /api/grievances - Get grievances list
app.get('/api/grievances', authenticateToken, async (req, res) => {
  const { status, category } = req.query;

  try {
    let query;
    let params = [];
    const conditions = [];

    if (req.user.is_admin) {
      query = `
        SELECT g.*, u.name AS user_name, u.email AS user_email 
        FROM grievances g 
        JOIN users u ON g.user_id = u.id
      `;

      if (status) {
        conditions.push('g.status = ?');
        params.push(status);
      }
      if (category) {
        conditions.push('g.category = ?');
        params.push(category);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY g.created_at DESC';
    } else {
      query = 'SELECT * FROM grievances WHERE user_id = ?';
      params = [req.user.id];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      query += ' ORDER BY created_at DESC';
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

// 6. PATCH /api/grievances/:id / status - Update status, urgency, or assignee (Admin Only)
app.patch(['/api/grievances/:id', '/api/grievances/:id/status'], authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, urgency, assigned_to } = req.body;

  if (!status && !urgency && assigned_to === undefined) {
    return res.status(400).json({ error: 'At least one field (status, urgency, or assigned_to) is required.' });
  }

  try {
    const [existing] = await db.query('SELECT status FROM grievances WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    const currentStatus = existing[0].status;
    const updates = [];
    const params = [];

    if (status) {
      const allowedStatuses = ['submitted', 'in-progress', 'resolved'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
      }

      if (currentStatus !== status) {
        const allowedNext = {
          'submitted': ['in-progress'],
          'in-progress': ['submitted', 'resolved'],
          'resolved': ['in-progress', 'submitted']
        };

        if (!allowedNext[currentStatus] || !allowedNext[currentStatus].includes(status)) {
          return res.status(400).json({ 
            error: `Invalid status transition. Cannot change status from '${currentStatus}' directly to '${status}'.` 
          });
        }
      }

      updates.push('status = ?');
      params.push(status);
    }
    if (urgency) {
      updates.push('urgency = ?');
      params.push(urgency);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to === '' ? null : assigned_to);
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

// --- FEEDBACK ROUTES ---

// 8. POST /api/feedback - Submit citizen feedback
app.post('/api/feedback', authenticateToken, async (req, res) => {
  const { feedback_type, rating, comments } = req.body;
  const user_id = req.user.id;

  if (!feedback_type || !rating || !comments) {
    return res.status(400).json({ error: 'Feedback type, rating, and comments are required.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO feedbacks (user_id, feedback_type, rating, comments) VALUES (?, ?, ?, ?)',
      [user_id, feedback_type, rating, comments]
    );
    res.status(201).json({ message: 'Feedback submitted successfully', feedbackId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save feedback.', details: err.message });
  }
});

// 9. GET /api/feedbacks - Retrieve all feedbacks (Admin only)
app.get('/api/feedbacks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT f.*, u.name AS user_name, u.email AS user_email 
      FROM feedbacks f 
      JOIN users u ON f.user_id = u.id 
      ORDER BY f.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve feedbacks.', details: err.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await db.query('SELECT 1');
    console.log('Connected to TiDB MySQL database successfully!');

    await db.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        feedback_type VARCHAR(100) NOT NULL,
        rating INT NOT NULL,
        comments TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Database feedbacks table checked/created successfully.');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
});