const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Multer File Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, Word, and Excel files are allowed.'));
    }
  }
});

// Helper for writing audit logs
async function logActivity(userId, action, details) {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [userId, action, details]
    );
  } catch (err) {
    console.error('Audit Logging Error:', err);
  }
}

// ------------------------------------------------------------------
// AUTHENTICATION & USER MANAGEMENT
// ------------------------------------------------------------------

// Login route
router.post('/auth/login', async (req, res) => {
  const { login_id, password } = req.body;

  if (!login_id || !password) {
    return res.status(400).json({ error: 'Login ID and password are required' });
  }

  try {
    const users = await db.query('SELECT * FROM users WHERE login_id = ?', [login_id]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid Login ID or Password' });
    }

    const user = users[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is disabled. Contact your administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Login ID or Password' });
    }

    const token = jwt.sign(
      { id: user.id, login_id: user.login_id, role: user.role, name: user.name, site_access: user.site_access },
      process.env.JWT_SECRET || 'BuildSyncProEnterpriseSuperSecretKey2026!',
      { expiresIn: '12h' }
    );

    await logActivity(user.id, 'User Login', 'User successfully logged in.');

    res.json({
      token,
      user: {
        id: user.id,
        login_id: user.login_id,
        role: user.role,
        name: user.name,
        site_access: user.site_access,
        status: user.status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current profile
router.get('/auth/profile', authenticateToken, async (req, res) => {
  try {
    const users = await db.query('SELECT id, login_id, role, site_access, status, name, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Self: Change own password
router.put('/auth/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  try {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    await logActivity(req.user.id, 'Change Password', 'User changed their own password.');

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error changing password' });
  }
});

// Admin-only: Get all users
router.get('/auth/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await db.query('SELECT id, login_id, role, site_access, status, name, created_at FROM users ORDER BY id DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error listing users' });
  }
});

// Admin-only: Create user
router.post('/auth/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { login_id, password, role, site_access, name } = req.body;

  if (!login_id || !password || !role || !name) {
    return res.status(400).json({ error: 'Missing required user fields' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE login_id = ?', [login_id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Login ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (login_id, password, role, site_access, status, name) VALUES (?, ?, ?, ?, ?, ?)',
      [login_id, hashedPassword, role, site_access || 'all', 'active', name]
    );

    await logActivity(req.user.id, 'Create User', `Created user ${login_id} (${name}) with role ${role}.`);

    // Notify other users
    req.io.emit('sync_users', { action: 'create', userId: result.insertId });

    res.status(201).json({ message: 'User created successfully', userId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Server error creating user' });
  }
});

// Admin-only: Edit user status and details
router.put('/auth/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { role, site_access, status, name } = req.body;
  const userId = req.params.id;

  try {
    const existing = await db.query('SELECT login_id FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      'UPDATE users SET role = ?, site_access = ?, status = ?, name = ? WHERE id = ?',
      [role, site_access, status, name, userId]
    );

    await logActivity(req.user.id, 'Update User', `Updated user ID ${userId} (Role: ${role}, Status: ${status}).`);

    req.io.emit('sync_users', { action: 'update', userId });

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating user' });
  }
});

// Admin-only: Reset user password
router.put('/auth/users/:id/password', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { password } = req.body;
  const userId = req.params.id;

  if (!password) {
    return res.status(400).json({ error: 'New password is required' });
  }

  try {
    const existing = await db.query('SELECT login_id FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    await logActivity(req.user.id, 'Reset Password', `Reset password for user ID ${userId}.`);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error resetting password' });
  }
});

// ------------------------------------------------------------------
// SITE MANAGEMENT MODULE
// ------------------------------------------------------------------

// Get all sites (filtered based on user role and site_access)
router.get('/sites', authenticateToken, async (req, res) => {
  try {
    let sql = 'SELECT s.*, u.name as supervisor_name, c.name as client_name FROM sites s LEFT JOIN users u ON s.assigned_supervisor_id = u.id LEFT JOIN users c ON s.assigned_client_id = c.id';
    let params = [];

    // Supervisors and staff can only see sites they are assigned to
    if (req.user.role !== 'admin' && req.user.role !== 'accountant') {
      if (req.user.site_access !== 'all') {
        const allowedIds = req.user.site_access.split(',').map(id => id.trim()).filter(id => id);
        if (allowedIds.length > 0) {
          const placeholders = allowedIds.map(() => '?').join(',');
          sql += ` WHERE s.site_id IN (${placeholders}) OR s.assigned_supervisor_id = ? OR s.assigned_client_id = ?`;
          params = [...allowedIds, req.user.id, req.user.id];
        } else {
          sql += ' WHERE s.assigned_supervisor_id = ? OR s.assigned_client_id = ?';
          params = [req.user.id, req.user.id];
        }
      }
    }

    sql += ' ORDER BY s.id DESC';
    const sites = await db.query(sql, params);
    res.json(sites);
  } catch (err) {
    res.status(500).json({ error: 'Server error listing sites' });
  }
});

// Get site by ID
router.get('/sites/:id', authenticateToken, async (req, res) => {
  try {
    const sites = await db.query(
      'SELECT s.*, u.name as supervisor_name, c.name as client_name FROM sites s LEFT JOIN users u ON s.assigned_supervisor_id = u.id LEFT JOIN users c ON s.assigned_client_id = c.id WHERE s.id = ?',
      [req.params.id]
    );

    if (sites.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(sites[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching site' });
  }
});

// Helper to synchronize supervisor site access
async function syncSupervisorSiteAccess(supervisorId) {
  if (!supervisorId) return;
  try {
    const sites = await db.query('SELECT site_id FROM sites WHERE assigned_supervisor_id = ?', [supervisorId]);
    const siteCodes = sites.map(s => s.site_id).join(',');
    await db.query('UPDATE users SET site_access = ? WHERE id = ?', [siteCodes || 'none', supervisorId]);
  } catch (err) {
    console.error('Failed to sync supervisor site access:', err);
  }
}

// Admin-only: Add site
router.post('/sites', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { site_id, name, location, project_type, assigned_supervisor_id, assigned_client_id, budget, start_date, completion_date, status, progress_percent } = req.body;

  if (!site_id || !name || !location || !project_type || budget === undefined || !start_date || !completion_date) {
    return res.status(400).json({ error: 'Missing required site fields' });
  }

  try {
    const existing = await db.query('SELECT id FROM sites WHERE site_id = ?', [site_id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Site ID already exists' });
    }

    const result = await db.query(
      'INSERT INTO sites (site_id, name, location, project_type, assigned_supervisor_id, assigned_client_id, budget, start_date, completion_date, status, progress_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [site_id, name, location, project_type, assigned_supervisor_id || null, assigned_client_id || null, budget, start_date, completion_date, status || 'planning', progress_percent || 0]
    );

    // Sync newly assigned supervisor
    if (assigned_supervisor_id) {
      await syncSupervisorSiteAccess(assigned_supervisor_id);
    }

    await logActivity(req.user.id, 'Create Site', `Created site ${name} (${site_id}) with budget ${budget}.`);

    // Notify users
    req.io.emit('sync_sites', { action: 'create', siteId: result.insertId });

    res.status(201).json({ message: 'Site created successfully', siteId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating site' });
  }
});

// Admin-only/Supervisor-progress: Update site
router.put('/sites/:id', authenticateToken, async (req, res) => {
  const siteId = req.params.id;
  const { name, location, project_type, assigned_supervisor_id, assigned_client_id, budget, start_date, completion_date, status, progress_percent } = req.body;

  try {
    const sites = await db.query('SELECT * FROM sites WHERE id = ?', [siteId]);
    if (sites.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const oldSupervisorId = sites[0].assigned_supervisor_id;

    // Role check: Only admin can edit site configuration. Supervisors can only update status/progress
    if (req.user.role !== 'admin') {
      // Check if this supervisor is assigned to the site
      if (sites[0].assigned_supervisor_id !== req.user.id) {
        return res.status(403).json({ error: 'You are not assigned to edit this site.' });
      }

      // Update only status and progress
      await db.query(
        'UPDATE sites SET status = ?, progress_percent = ? WHERE id = ?',
        [status, progress_percent, siteId]
      );
      
      // Auto-post to timeline
      await db.query(
        'INSERT INTO project_timeline (site_id, user_id, event_type, description) VALUES (?, ?, ?, ?)',
        [siteId, req.user.id, 'progress', `Site progress updated to ${progress_percent}% (Status: ${status})`]
      );
      
      await logActivity(req.user.id, 'Update Site Progress', `Updated progress of site ID ${siteId} to ${progress_percent}% (${status}).`);
    } else {
      // Admin update all
      await db.query(
        'UPDATE sites SET name = ?, location = ?, project_type = ?, assigned_supervisor_id = ?, assigned_client_id = ?, budget = ?, start_date = ?, completion_date = ?, status = ?, progress_percent = ? WHERE id = ?',
        [name, location, project_type, assigned_supervisor_id || null, assigned_client_id || null, budget, start_date, completion_date, status, progress_percent, siteId]
      );

      // Sync old supervisor site access if changed
      if (oldSupervisorId && oldSupervisorId !== assigned_supervisor_id) {
        await syncSupervisorSiteAccess(oldSupervisorId);
      }
      // Sync new supervisor site access
      if (assigned_supervisor_id) {
        await syncSupervisorSiteAccess(assigned_supervisor_id);
      }

      await logActivity(req.user.id, 'Update Site', `Updated details for site ID ${siteId}.`);
    }

    req.io.emit('sync_sites', { action: 'update', siteId });

    res.json({ message: 'Site updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating site' });
  }
});

// Admin-only: Delete site
router.delete('/sites/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const siteId = req.params.id;
  try {
    const sites = await db.query('SELECT name, assigned_supervisor_id FROM sites WHERE id = ?', [siteId]);
    if (sites.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const supervisorId = sites[0].assigned_supervisor_id;

    await db.query('DELETE FROM sites WHERE id = ?', [siteId]);

    // Sync supervisor
    if (supervisorId) {
      await syncSupervisorSiteAccess(supervisorId);
    }

    await logActivity(req.user.id, 'Delete Site', `Deleted site ${sites[0].name} (ID: ${siteId}).`);

    req.io.emit('sync_sites', { action: 'delete', siteId });

    res.json({ message: 'Site deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting site' });
  }
});

// ------------------------------------------------------------------
// EXPENSE MANAGEMENT MODULE
// ------------------------------------------------------------------

// Get all expenses (with filters for site_id, category, and date ranges)
router.get('/expenses', authenticateToken, async (req, res) => {
  const { site_id, category, start_date, end_date } = req.query;

  try {
    let sql = `
      SELECT e.*, s.name as site_name, s.site_id as site_code, u.name as added_by_name 
      FROM expenses e 
      LEFT JOIN sites s ON e.site_id = s.id 
      LEFT JOIN users u ON e.added_by = u.id
    `;
    let params = [];
    let conditions = [];

    // Role-based filtering: Limit supervisor/staff to assigned sites
    if (req.user.role !== 'admin' && req.user.role !== 'accountant') {
      if (req.user.site_access !== 'all') {
        const allowedIds = req.user.site_access.split(',').map(id => id.trim()).filter(id => id);
        if (allowedIds.length > 0) {
          const placeholders = allowedIds.map(() => '?').join(',');
          conditions.push(`(s.site_id IN (${placeholders}) OR s.assigned_supervisor_id = ?)`);
          params.push(...allowedIds, req.user.id);
        } else {
          conditions.push('s.assigned_supervisor_id = ?');
          params.push(req.user.id);
        }
      }
    }

    if (site_id) {
      conditions.push('e.site_id = ?');
      params.push(site_id);
    }

    if (category) {
      conditions.push('e.category = ?');
      params.push(category);
    }

    if (start_date) {
      conditions.push('e.date_time >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('e.date_time <= ?');
      params.push(end_date);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY e.date_time DESC';
    const expenses = await db.query(sql, params);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching expenses' });
  }
});

// Add expense
router.post('/expenses', authenticateToken, upload.single('invoice'), async (req, res) => {
  const { title, amount, category, site_id, date_time, notes } = req.body;
  const invoice_url = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || amount === undefined || !category || !site_id || !date_time) {
    return res.status(400).json({ error: 'Missing required expense fields' });
  }

  try {
    // Role check: Admin, Accountant, and Assigned Supervisor can add expenses
    const sites = await db.query('SELECT * FROM sites WHERE id = ?', [site_id]);
    if (sites.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = sites[0];

    if (req.user.role !== 'admin' && req.user.role !== 'accountant') {
      if (site.assigned_supervisor_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You are not the assigned supervisor for this site.' });
      }
    }

    const result = await db.query(
      'INSERT INTO expenses (title, amount, category, site_id, added_by, date_time, notes, invoice_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, amount, category, site_id, req.user.id, date_time, notes || '', invoice_url]
    );

    // Audit Log
    await logActivity(req.user.id, 'Add Expense', `Added expense "${title}" of amount ${amount} in category "${category}" to site "${site.name}".`);

    // Budget check: Calculate total expenses for this site
    const sumResult = await db.query('SELECT SUM(amount) as total FROM expenses WHERE site_id = ?', [site_id]);
    const currentTotal = sumResult[0].total || 0;

    let warning = null;
    if (currentTotal > site.budget) {
      warning = `Warning: The budget for "${site.name}" has been exceeded! (Budget: ${site.budget}, Total Expenses: ${currentTotal})`;
      
      // Auto register alert in requests / notifications
      await db.query(
        'INSERT INTO requests (type, title, description, site_id, submitted_by, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['issue', 'Budget Exceeded Alert', warning, site_id, req.user.id, 'pending']
      );
    }

    const newExpense = {
      id: result.insertId,
      title,
      amount,
      category,
      site_id,
      site_name: site.name,
      added_by: req.user.id,
      added_by_name: req.user.name,
      date_time,
      notes,
      invoice_url
    };

    // Emit Realtime sync event
    req.io.emit('expense_added', { expense: newExpense, totalExpenses: currentTotal, warning });
    
    res.status(201).json({ message: 'Expense added successfully', expense: newExpense, warning });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error adding expense' });
  }
});

// Update expense
router.put('/expenses/:id', authenticateToken, upload.single('invoice'), async (req, res) => {
  const expenseId = req.params.id;
  const { title, amount, category, date_time, notes } = req.body;

  try {
    const expenses = await db.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = expenses[0];
    const sites = await db.query('SELECT * FROM sites WHERE id = ?', [expense.site_id]);
    const site = sites[0];

    // Role check: Admin, Accountant, or owner can edit
    if (req.user.role !== 'admin' && req.user.role !== 'accountant' && expense.added_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot edit this expense.' });
    }

    let invoice_url = expense.invoice_url;
    if (req.file) {
      // Delete old file if exists
      if (invoice_url) {
        const oldPath = path.join(__dirname, '..', invoice_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      invoice_url = `/uploads/${req.file.filename}`;
    }

    await db.query(
      'UPDATE expenses SET title = ?, amount = ?, category = ?, date_time = ?, notes = ?, invoice_url = ? WHERE id = ?',
      [title, amount, category, date_time, notes || '', invoice_url, expenseId]
    );

    await logActivity(req.user.id, 'Update Expense', `Updated expense ID ${expenseId} ("${title}", amount ${amount}).`);

    // Budget check
    const sumResult = await db.query('SELECT SUM(amount) as total FROM expenses WHERE site_id = ?', [expense.site_id]);
    const currentTotal = sumResult[0].total || 0;
    
    let warning = null;
    if (currentTotal > site.budget) {
      warning = `Warning: The budget for "${site.name}" has been exceeded! (Budget: ${site.budget}, Total Expenses: ${currentTotal})`;
    }

    req.io.emit('expense_updated', { expenseId, siteId: expense.site_id, totalExpenses: currentTotal, warning });

    res.json({ message: 'Expense updated successfully', warning });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating expense' });
  }
});

// Delete expense
router.delete('/expenses/:id', authenticateToken, async (req, res) => {
  const expenseId = req.params.id;

  try {
    const expenses = await db.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = expenses[0];

    // Role check: Admin, Accountant, or owner can delete
    if (req.user.role !== 'admin' && req.user.role !== 'accountant' && expense.added_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot delete this expense.' });
    }

    // Delete uploaded invoice file
    if (expense.invoice_url) {
      const filePath = path.join(__dirname, '..', expense.invoice_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.query('DELETE FROM expenses WHERE id = ?', [expenseId]);
    await logActivity(req.user.id, 'Delete Expense', `Deleted expense "${expense.title}" of amount ${expense.amount}.`);

    // Calculate new total
    const sumResult = await db.query('SELECT SUM(amount) as total FROM expenses WHERE site_id = ?', [expense.site_id]);
    const currentTotal = sumResult[0].total || 0;

    req.io.emit('expense_deleted', { expenseId, siteId: expense.site_id, totalExpenses: currentTotal });

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting expense' });
  }
});

// ------------------------------------------------------------------
// REQUESTS & UPDATES SYSTEM
// ------------------------------------------------------------------

// Get all requests
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    let sql = `
      SELECT r.*, s.name as site_name, u.name as submitted_by_name 
      FROM requests r 
      LEFT JOIN sites s ON r.site_id = s.id 
      LEFT JOIN users u ON r.submitted_by = u.id
    `;
    let params = [];

    // Supervisors and staff can only see their requests
    if (req.user.role !== 'admin' && req.user.role !== 'accountant') {
      sql += ' WHERE r.submitted_by = ?';
      params = [req.user.id];
    }

    sql += ' ORDER BY r.id DESC';
    const requests = await db.query(sql, params);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching requests' });
  }
});

// Submit a request (Supervisor/Staff only)
router.post('/requests', authenticateToken, upload.single('attachment'), async (req, res) => {
  const { type, title, description, site_id } = req.body;
  const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;

  if (!type || !title || !description || !site_id) {
    return res.status(400).json({ error: 'Missing required request fields' });
  }

  try {
    const result = await db.query(
      'INSERT INTO requests (type, title, description, site_id, submitted_by, status, reply, attachment_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [type, title, description, site_id, req.user.id, 'pending', '', attachment_url]
    );

    await logActivity(req.user.id, 'Submit Request', `Submitted request of type "${type}": "${title}".`);

    const newRequest = {
      id: result.insertId,
      type,
      title,
      description,
      site_id,
      submitted_by: req.user.id,
      submitted_by_name: req.user.name,
      status: 'pending',
      reply: '',
      attachment_url,
      created_at: new Date()
    };

    // Emit Realtime sync notification to Admins
    req.io.emit('request_submitted', newRequest);

    res.status(201).json({ message: 'Request submitted successfully', request: newRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error submitting request' });
  }
});

// Admin-only: Approve/Reject/Reply to request
router.put('/requests/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { status, reply } = req.body;
  const requestId = req.params.id;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const requests = await db.query('SELECT * FROM requests WHERE id = ?', [requestId]);
    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await db.query(
      'UPDATE requests SET status = ?, reply = ? WHERE id = ?',
      [status, reply || '', requestId]
    );

    await logActivity(req.user.id, 'Process Request', `Status for request ID ${requestId} changed to "${status}".`);

    // Emit Realtime sync to supervisor
    req.io.emit('request_processed', { requestId, status, reply, processedBy: req.user.name });

    res.json({ message: 'Request updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating request' });
  }
});

// Setup separate audio upload instance for voice recordings
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'voice-' + uniqueSuffix + '.webm');
  }
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max for audio
});

// Chat audio file upload route
router.post('/chats/upload-audio', authenticateToken, uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ fileUrl });
  } catch (err) {
    console.error('Audio upload error:', err);
    res.status(500).json({ error: 'Failed to upload audio file.' });
  }
});

// Get messages (all messages in main dashboard channel)
router.get('/chats', authenticateToken, async (req, res) => {
  try {
    // Get all chat messages. To keep it simple, we use a single channel for workspace collaboration
    const messages = await db.query(`
      SELECT m.*, u.name as sender_name, u.role as sender_role 
      FROM chat_messages m
      JOIN users u ON m.sender_id = u.id
      ORDER BY m.id ASC
      LIMIT 100
    `);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching chats' });
  }
});

// Post a message
router.post('/chats', authenticateToken, async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [req.user.id, null, message]
    );

    const newMsg = {
      id: result.insertId,
      sender_id: req.user.id,
      sender_name: req.user.name,
      sender_role: req.user.role,
      receiver_id: null,
      message,
      created_at: new Date()
    };

    req.io.emit('chat_message', newMsg);

    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ error: 'Server error sending message' });
  }
});

// Delete a chat message
router.delete('/chats/:id', authenticateToken, async (req, res) => {
  const messageId = req.params.id;

  try {
    // 1. Fetch message to check ownership and get audio file if it exists
    const messages = await db.query('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[0];

    // 2. Validate permissions: user is admin OR the sender of the message
    if (req.user.role !== 'admin' && message.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this message' });
    }

    // 3. If it's an audio message, delete the physical file on the server
    if (message.message && message.message.startsWith('[AUDIO_MESSAGE]:')) {
      const relativePath = message.message.replace('[AUDIO_MESSAGE]:', '').trim();
      const filePath = path.join(__dirname, '..', relativePath);
      
      // Safety check: ensure file is inside the uploads directory (prevent path traversal)
      if (filePath.startsWith(path.join(__dirname, '..', 'uploads'))) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Failed to delete physical audio file:', err);
          } else {
            console.log('Successfully deleted physical audio file:', filePath);
          }
        });
      }
    }

    // 4. Delete from database
    await db.query('DELETE FROM chat_messages WHERE id = ?', [messageId]);

    // 5. Emit delete event via Socket.IO
    req.io.emit('chat_message_deleted', messageId);

    res.json({ message: 'Message deleted successfully', messageId });
  } catch (err) {
    console.error('Error deleting chat message:', err);
    res.status(500).json({ error: 'Server error deleting message' });
  }
});

// ------------------------------------------------------------------
// AUDIT TRAILS & DASHBOARD METRICS
// ------------------------------------------------------------------

// Admin/Accountant-only: Get audit logs (Activity logs)
router.get('/activity-logs', authenticateToken, requireRole(['admin', 'accountant']), async (req, res) => {
  try {
    const logs = await db.query(`
      SELECT l.*, u.name as user_name, u.role as user_role 
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 200
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching activity logs' });
  }
});

// Get dashboard metrics
router.get('/dashboard-metrics', authenticateToken, async (req, res) => {
  try {
    let siteCountResult, expenseSumResult, pendingRequestResult, expenseCategoryResult, monthlyTrendResult;
    
    // Admins and Accountants see all database metrics
    if (req.user.role === 'admin' || req.user.role === 'accountant') {
      siteCountResult = await db.query('SELECT COUNT(*) as count FROM sites WHERE status = "in-progress" OR status = "planning"');
      expenseSumResult = await db.query('SELECT SUM(amount) as total FROM expenses');
      pendingRequestResult = await db.query('SELECT COUNT(*) as count FROM requests WHERE status = "pending"');
      
      expenseCategoryResult = await db.query(`
        SELECT category, SUM(amount) as value 
        FROM expenses 
        GROUP BY category
      `);

      // Mock or fetch weekly/monthly trends. In real app, we group by month
      const monthlySql = db.isSQLite() ? 
        `SELECT strftime('%Y-%m', date_time) as month, SUM(amount) as total FROM expenses GROUP BY month ORDER BY month DESC LIMIT 6` :
        `SELECT DATE_FORMAT(date_time, '%Y-%m') as month, SUM(amount) as total FROM expenses GROUP BY month ORDER BY month DESC LIMIT 6`;
      monthlyTrendResult = await db.query(monthlySql);

    } else {
      // Limit to sites assigned
      let siteFilter = 'WHERE s.assigned_supervisor_id = ?';
      let params = [req.user.id];

      if (req.user.site_access !== 'all') {
        const allowedIds = req.user.site_access.split(',').map(id => id.trim()).filter(id => id);
        if (allowedIds.length > 0) {
          const placeholders = allowedIds.map(() => '?').join(',');
          siteFilter = `WHERE s.site_id IN (${placeholders}) OR s.assigned_supervisor_id = ?`;
          params = [...allowedIds, req.user.id];
        }
      }

      siteCountResult = await db.query(`SELECT COUNT(*) as count FROM sites s ${siteFilter} AND (s.status = 'in-progress' OR s.status = 'planning')`, params);
      expenseSumResult = await db.query(`
        SELECT SUM(e.amount) as total 
        FROM expenses e 
        JOIN sites s ON e.site_id = s.id 
        ${siteFilter}
      `, params);
      
      pendingRequestResult = await db.query(`SELECT COUNT(*) as count FROM requests WHERE submitted_by = ? AND status = 'pending'`, [req.user.id]);
      
      expenseCategoryResult = await db.query(`
        SELECT e.category, SUM(e.amount) as value 
        FROM expenses e 
        JOIN sites s ON e.site_id = s.id
        ${siteFilter}
        GROUP BY e.category
      `, params);

      let monthlySql = '';
      if (db.isSQLite && db.isSQLite()) {
        monthlySql = `SELECT strftime('%Y-%m', e.date_time) as month, SUM(e.amount) as total 
         FROM expenses e 
         JOIN sites s ON e.site_id = s.id 
         ${siteFilter}
         GROUP BY month ORDER BY month DESC LIMIT 6`;
      } else if (db.isPostgres && db.isPostgres()) {
        monthlySql = `SELECT TO_CHAR(e.date_time, 'YYYY-MM') as month, SUM(e.amount) as total 
         FROM expenses e 
         JOIN sites s ON e.site_id = s.id 
         ${siteFilter}
         GROUP BY month ORDER BY month DESC LIMIT 6`;
      } else {
        monthlySql = `SELECT DATE_FORMAT(e.date_time, '%Y-%m') as month, SUM(e.amount) as total 
         FROM expenses e 
         JOIN sites s ON e.site_id = s.id 
         ${siteFilter}
         GROUP BY month ORDER BY month DESC LIMIT 6`;
      }

      monthlyTrendResult = await db.query(monthlySql, params);
    }

    // Budget status details
    let budgetStatusSql = `
      SELECT s.id, s.name, s.budget, COALESCE(SUM(e.amount), 0) as spent
      FROM sites s
      LEFT JOIN expenses e ON s.id = e.site_id
    `;
    let budgetParams = [];
    if (req.user.role !== 'admin' && req.user.role !== 'accountant') {
      if (req.user.site_access !== 'all') {
        const allowedIds = req.user.site_access.split(',').map(id => id.trim()).filter(id => id);
        if (allowedIds.length > 0) {
          const placeholders = allowedIds.map(() => '?').join(',');
          budgetStatusSql += ` WHERE s.site_id IN (${placeholders}) OR s.assigned_supervisor_id = ?`;
          budgetParams = [...allowedIds, req.user.id];
        } else {
          budgetStatusSql += ` WHERE s.assigned_supervisor_id = ?`;
          budgetParams = [req.user.id];
        }
      } else {
        budgetStatusSql += ` WHERE s.assigned_supervisor_id = ?`;
        budgetParams = [req.user.id];
      }
    }
    budgetStatusSql += ` GROUP BY s.id, s.name, s.budget`;
    const budgetStatusResult = await db.query(budgetStatusSql, budgetParams);

    res.json({
      activeSites: siteCountResult[0].count || 0,
      totalExpenses: expenseSumResult[0].total || 0,
      pendingRequests: pendingRequestResult[0].count || 0,
      categoryExpenses: expenseCategoryResult,
      monthlyTrends: monthlyTrendResult.reverse(),
      budgetStatus: budgetStatusResult
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving dashboard metrics' });
  }
});
// ------------------------------------------------------------------
// BUDGETS & PRODUCT VERIFICATION MODULE
// ------------------------------------------------------------------

router.get('/budgets', authenticateToken, async (req, res) => {
  const { site_id } = req.query;
  try {
    let sql = 'SELECT b.*, s.name as site_name FROM budgets b JOIN sites s ON b.site_id = s.id';
    const params = [];
    if (site_id) {
      sql += ' WHERE b.site_id = ?';
      params.push(site_id);
    }
    sql += ' ORDER BY b.id DESC';
    const budgets = await db.query(sql, params);
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching budgets' });
  }
});

router.post('/budgets', authenticateToken, requireRole(['admin', 'accountant']), async (req, res) => {
  const { site_id, category, item_name, budget_allocation, actual_cost, brand, model_number, serial_number, batch_number, sku, supplier_details } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO budgets (site_id, category, item_name, budget_allocation, actual_cost, brand, model_number, serial_number, batch_number, sku, supplier_details, delivery_status, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [site_id, category, item_name, budget_allocation, actual_cost || 0, brand || null, model_number || null, serial_number || null, batch_number || null, sku || null, supplier_details || null, 'pending', 'pending']
    );
    res.status(201).json({ message: 'Budget item created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Server error creating budget' });
  }
});

router.put('/budgets/:id/verify', authenticateToken, async (req, res) => {
  const { delivery_status, actual_cost, serial_number, batch_number } = req.body;
  try {
    await db.query(
      'UPDATE budgets SET delivery_status = ?, actual_cost = ?, serial_number = ?, batch_number = ? WHERE id = ?',
      [delivery_status, actual_cost, serial_number, batch_number, req.params.id]
    );
    
    // Auto-post to timeline
    await db.query(
      'INSERT INTO project_timeline (site_id, user_id, event_type, description) VALUES ((SELECT site_id FROM budgets WHERE id = ?), ?, ?, ?)',
      [req.params.id, req.user.id, 'approval', `Verified product ID ${req.params.id}. Status: ${delivery_status}. Cost: ₹${actual_cost}.`]
    );

    await logActivity(req.user.id, 'Product Verification', `Verified product ID ${req.params.id} (Status: ${delivery_status}).`);
    res.json({ message: 'Product verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error verifying product' });
  }
});

// ------------------------------------------------------------------
// DAILY SITE UPDATES MODULE
// ------------------------------------------------------------------

router.get('/daily-updates', authenticateToken, async (req, res) => {
  const { site_id } = req.query;
  try {
    let sql = 'SELECT d.*, u.name as supervisor_name FROM daily_updates d JOIN users u ON d.supervisor_id = u.id';
    const params = [];
    if (site_id) {
      sql += ' WHERE d.site_id = ?';
      params.push(site_id);
    }
    sql += ' ORDER BY d.update_date DESC';
    const updates = await db.query(sql, params);
    res.json(updates);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching daily updates' });
  }
});

router.post('/daily-updates', authenticateToken, upload.array('media', 5), async (req, res) => {
  const { site_id, update_date, notes, work_completed } = req.body;
  try {
    const media_urls = req.files ? req.files.map(f => `/uploads/${f.filename}`).join(',') : '';
    const result = await db.query(
      'INSERT INTO daily_updates (site_id, supervisor_id, update_date, notes, work_completed, media_urls) VALUES (?, ?, ?, ?, ?, ?)',
      [site_id, req.user.id, update_date, notes, work_completed, media_urls]
    );
    
    // Auto-post to timeline
    await db.query(
      'INSERT INTO project_timeline (site_id, user_id, event_type, description, attachments) VALUES (?, ?, ?, ?, ?)',
      [site_id, req.user.id, 'progress', `Daily Update: ${work_completed}\nNotes: ${notes || 'None'}`, media_urls]
    );
    
    req.io.emit('new_daily_update', { site_id, update_id: result.insertId });
    // Also emit timeline update
    const newEntry = {
      id: result.insertId + 10000, // mock id
      site_id,
      user_name: req.user.name,
      user_role: req.user.role,
      event_type: 'progress',
      description: `Daily Update: ${work_completed}\nNotes: ${notes || 'None'}`,
      attachments: media_urls,
      created_at: new Date()
    };
    req.io.emit('timeline_update', newEntry);
    
    res.status(201).json({ message: 'Daily update submitted', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Server error submitting daily update' });
  }
});

router.post('/daily-updates/:id/comments', authenticateToken, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text is required' });

  try {
    const updateCheck = await db.query('SELECT comments FROM daily_updates WHERE id = ?', [req.params.id]);
    if (updateCheck.length === 0) return res.status(404).json({ error: 'Update not found' });
    
    let comments = [];
    try {
      comments = JSON.parse(updateCheck[0].comments || '[]');
    } catch(e) {
      comments = [];
    }

    const newComment = {
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      text: text,
      date: new Date().toISOString()
    };
    
    comments.push(newComment);
    
    await db.query('UPDATE daily_updates SET comments = ? WHERE id = ?', [JSON.stringify(comments), req.params.id]);
    
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ error: 'Server error adding comment' });
  }
});

// ------------------------------------------------------------------
// AGREEMENTS & AI PARSER MODULE
// ------------------------------------------------------------------

router.post('/agreements/parse', authenticateToken, requireRole(['admin']), upload.single('agreement'), async (req, res) => {
  const { site_id } = req.body;
  if (!req.file || !site_id) {
    return res.status(400).json({ error: 'Missing file or site_id' });
  }
  try {
    const file_url = `/uploads/${req.file.filename}`;
    
    // MOCK AI EXTRACTION
    const extractedTotal = 4500000;
    const extractedData = JSON.stringify({
      categories: [
        { category: 'Tiles', amount: 300000 },
        { category: 'Paint', amount: 150000 },
        { category: 'Furniture', amount: 800000 },
        { category: 'Electrical', amount: 250000 }
      ]
    });
    
    const result = await db.query(
      'INSERT INTO agreements (site_id, file_url, total_cost, extracted_data, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [site_id, file_url, extractedTotal, extractedData, req.user.id]
    );
    
    // Auto-create budget items
    const parsed = JSON.parse(extractedData);
    for (const cat of parsed.categories) {
      await db.query(
        'INSERT INTO budgets (site_id, category, item_name, budget_allocation) VALUES (?, ?, ?, ?)',
        [site_id, cat.category, `AI Extracted: ${cat.category} Budget`, cat.amount]
      );
    }
    
    // Auto-post to timeline
    await db.query(
      'INSERT INTO project_timeline (site_id, user_id, event_type, description, attachments) VALUES (?, ?, ?, ?, ?)',
      [site_id, req.user.id, 'approval', `AI Parser generated new budget split-up from uploaded agreement. Total Extracted Cost: ₹${extractedTotal.toLocaleString()}`, file_url]
    );
    
    res.status(201).json({ message: 'Agreement parsed successfully', extractedTotal, categories: parsed.categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error parsing agreement' });
  }
});

router.get('/agreements', authenticateToken, async (req, res) => {
  const { site_id } = req.query;
  try {
    let sql = 'SELECT a.*, u.name as uploaded_by_name FROM agreements a LEFT JOIN users u ON a.uploaded_by = u.id';
    const params = [];
    if (site_id) {
      sql += ' WHERE a.site_id = ?';
      params.push(site_id);
    }
    const agreements = await db.query(sql, params);
    res.json(agreements);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching agreements' });
  }
});
// ------------------------------------------------------------------
// PROJECT TIMELINE & COLLABORATION MODULE
// ------------------------------------------------------------------

router.get('/project-timeline/:site_id', authenticateToken, async (req, res) => {
  const siteId = req.params.site_id;
  try {
    const timeline = await db.query(
      `SELECT t.*, u.name as user_name, u.role as user_role 
       FROM project_timeline t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE t.site_id = ? 
       ORDER BY t.created_at DESC`,
      [siteId]
    );
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching timeline' });
  }
});

router.post('/project-timeline', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  const { site_id, event_type, description } = req.body;
  if (!site_id || !description) return res.status(400).json({ error: 'Site and description required' });

  try {
    const attachments = req.files ? req.files.map(f => `/uploads/${f.filename}`).join(',') : '';
    const result = await db.query(
      'INSERT INTO project_timeline (site_id, user_id, event_type, description, attachments) VALUES (?, ?, ?, ?, ?)',
      [site_id, req.user.id, event_type || 'comment', description, attachments]
    );
    
    const newEntry = {
      id: result.insertId,
      site_id,
      user_id: req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      event_type: event_type || 'comment',
      description,
      attachments,
      created_at: new Date()
    };
    
    req.io.emit('timeline_update', newEntry);
    res.status(201).json(newEntry);
  } catch (err) {
    res.status(500).json({ error: 'Server error posting to timeline' });
  }
});

// ------------------------------------------------------------------
// PAYMENT SCHEDULES MODULE
// ------------------------------------------------------------------

router.get('/sites/:id/payments', authenticateToken, async (req, res) => {
  try {
    const payments = await db.query(
      'SELECT * FROM payment_schedules WHERE site_id = ? ORDER BY due_date ASC, created_at ASC',
      [req.params.id]
    );
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching payments' });
  }
});

router.post('/sites/:id/payments', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { title, expected_amount, due_date, is_adhoc } = req.body;
  if (!title || !expected_amount) return res.status(400).json({ error: 'Title and amount required' });

  try {
    const result = await db.query(
      'INSERT INTO payment_schedules (site_id, title, expected_amount, due_date, is_adhoc) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, title, expected_amount, due_date || null, is_adhoc ? 1 : 0]
    );
    res.status(201).json({ message: 'Payment scheduled', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Server error adding payment' });
  }
});

router.put('/sites/:site_id/payments/:payment_id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { paid_amount, payment_date, status } = req.body;
  try {
    await db.query(
      'UPDATE payment_schedules SET paid_amount = ?, payment_date = ?, status = ? WHERE id = ? AND site_id = ?',
      [paid_amount, payment_date || new Date().toISOString().split('T')[0], status || 'paid', req.params.payment_id, req.params.site_id]
    );
    res.json({ message: 'Payment updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating payment' });
  }
});

module.exports = router;
