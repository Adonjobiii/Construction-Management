const { db, initializeDatabase } = require('./database');

(async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized.');

    // 1. Sites
    try {
      await db.query(`
        SELECT s.*, 
               u1.name as supervisor_name, 
               u2.name as client_name
        FROM sites s
        LEFT JOIN users u1 ON s.assigned_supervisor_id = u1.id
        LEFT JOIN users u2 ON s.assigned_client_id = u2.id
        ORDER BY s.id DESC
      `);
      console.log('Sites query passed.');
    } catch (err) { console.error('Sites fail:', err.message); }

    // 2. Expenses
    try {
      await db.query(`
        SELECT e.*, s.name as site_name, u.name as added_by_name
        FROM expenses e
        LEFT JOIN sites s ON e.site_id = s.id
        LEFT JOIN users u ON e.added_by = u.id
        ORDER BY e.date_time DESC
      `);
      console.log('Expenses query passed.');
    } catch (err) { console.error('Expenses fail:', err.message); }

    // 3. Requests
    try {
      await db.query(`
        SELECT r.*, s.name as site_name, u.name as submitted_by_name
        FROM requests r
        LEFT JOIN sites s ON r.site_id = s.id
        LEFT JOIN users u ON r.submitted_by = u.id
        ORDER BY r.created_at DESC
      `);
      console.log('Requests query passed.');
    } catch (err) { console.error('Requests fail:', err.message); }

    // 4. Chats
    try {
      await db.query(`
        SELECT c.*, u.name as sender_name
        FROM chat_messages c
        LEFT JOIN users u ON c.sender_id = u.id
        ORDER BY c.created_at ASC
      `);
      console.log('Chats query passed.');
    } catch (err) { console.error('Chats fail:', err.message); }

    // 5. Dashboard Metrics (this has multiple)
    try {
      await db.query('SELECT COUNT(*) as count FROM sites');
      await db.query('SELECT SUM(budget) as total FROM sites');
      await db.query('SELECT SUM(amount) as total FROM expenses');
      await db.query('SELECT COUNT(*) as count FROM users WHERE role = ?', ['supervisor']);
      console.log('Metrics queries passed.');
    } catch (err) { console.error('Metrics fail:', err.message); }

    // 6. Activity Logs
    try {
      await db.query(`
        SELECT a.*, u.name as user_name, u.role as user_role 
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 100
      `);
      console.log('Logs query passed.');
    } catch (err) { console.error('Logs fail:', err.message); }

    process.exit(0);
  } catch (err) {
    console.error('Fatal:', err);
    process.exit(1);
  }
})();
