const { db, initializeDatabase } = require('./database.js');

async function fix() {
  try {
    await initializeDatabase();
    
    const isSQLite = db.isSQLite();
    const sql = isSQLite ? `
      CREATE TABLE IF NOT EXISTS payment_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER,
        title TEXT NOT NULL,
        expected_amount REAL NOT NULL,
        due_date TEXT,
        paid_amount REAL DEFAULT 0,
        payment_date TEXT,
        status TEXT DEFAULT 'pending',
        is_adhoc BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
      )
    ` : `
      CREATE TABLE IF NOT EXISTS payment_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        site_id INT,
        title VARCHAR(255) NOT NULL,
        expected_amount DECIMAL(15,2) NOT NULL,
        due_date DATE,
        paid_amount DECIMAL(15,2) DEFAULT 0,
        payment_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        is_adhoc BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    
    await db.query(sql);
    console.log('Created payment_schedules table');
  } catch(e) {
    console.log('Error: ', e.message);
  }
}

fix();
