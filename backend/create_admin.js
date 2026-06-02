const { db, initializeDatabase } = require('./database');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    // Ensure DB is connected and tables exist
    await initializeDatabase();
    
    console.log('Checking for admin user...');
    const adminUsers = await db.query('SELECT * FROM users WHERE login_id = ?', ['admin']);
    
    if (adminUsers.length === 0) {
      const hashedAdmin = await bcrypt.hash('admin123', 10);
      await db.query(
        'INSERT INTO users (login_id, password, role, site_access, status, name) VALUES (?, ?, ?, ?, ?, ?)',
        ['admin', hashedAdmin, 'admin', 'all', 'active', 'System Administrator']
      );
      console.log('Success! Created temporary admin user: login_id="admin", password="admin123"');
    } else {
      // If it exists, let's force update the password to admin123 just in case it was changed
      const hashedAdmin = await bcrypt.hash('admin123', 10);
      await db.query('UPDATE users SET password = ? WHERE login_id = ?', [hashedAdmin, 'admin']);
      console.log('Success! Reset existing admin user password to "admin123"');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
