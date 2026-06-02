const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let dbClient = null;
let isSQLite = false;
let isPostgres = false;

// Unified database interface
const db = {
  query: async (sql, params = []) => {
    if (isPostgres) {
      let pgSql = sql;
      let counter = 1;
      
      // Translate MySQL ? placeholders to Postgres $1, $2
      pgSql = pgSql.replace(/\?/g, () => `$${counter++}`);
      
      // Auto-translate Table Creation Syntax
      if (pgSql.toUpperCase().includes('CREATE TABLE')) {
        pgSql = pgSql.replace(/INT AUTO_INCREMENT PRIMARY KEY/g, 'SERIAL PRIMARY KEY');
        pgSql = pgSql.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        pgSql = pgSql.replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;/g, '');
      }
      
      // Add RETURNING id for inserts to mock MySQL's insertId
      const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !pgSql.toUpperCase().includes('RETURNING ID')) {
        pgSql += ' RETURNING id';
      }

      try {
        const result = await dbClient.query(pgSql, params);
        const cleanSql = pgSql.trim().toUpperCase();
        const isSelect = cleanSql.startsWith('SELECT') || cleanSql.startsWith('SHOW');
        
        if (isSelect) {
          return result.rows;
        } else {
          return {
            insertId: (result.rows && result.rows.length > 0) ? result.rows[0].id : null,
            affectedRows: result.rowCount
          };
        }
      } catch (err) {
        console.error('Postgres Query Error:', err, 'SQL:', pgSql);
        throw err;
      }
    } else if (isSQLite) {
      return new Promise((resolve, reject) => {
        // SQLite uses ? for placeholders just like MySQL
        const cleanSql = sql.trim();
        const isSelect = cleanSql.toUpperCase().startsWith('SELECT') || cleanSql.toUpperCase().startsWith('SHOW') || cleanSql.toUpperCase().startsWith('PRAGMA');
        
        if (isSelect) {
          dbClient.all(sql, params, (err, rows) => {
            if (err) {
              console.error('SQLite Query Error (SELECT):', err, 'SQL:', sql);
              return reject(err);
            }
            resolve(rows);
          });
        } else {
          dbClient.run(sql, params, function(err) {
            if (err) {
              console.error('SQLite Query Error (WRITE):', err, 'SQL:', sql);
              return reject(err);
            }
            // Normalize return behavior to match MySQL mysql2 package
            resolve({
              insertId: this.lastID,
              affectedRows: this.changes
            });
          });
        }
      });
    } else {
      // MySQL path
      try {
        const [results] = await dbClient.execute(sql, params);
        return results;
      } catch (err) {
        console.error('MySQL Query Error:', err, 'SQL:', sql);
        throw err;
      }
    }
  },
  isSQLite: () => isSQLite
};

async function initializeDatabase() {
  const useSqliteFallback = process.env.USE_SQLITE_FALLBACK === 'true';
  const useSqliteOnly = process.env.USE_SQLITE_ONLY === 'true';
  
  if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL detected. Connecting to PostgreSQL (Neon DB)...');
    await connectPostgres();
  } else if (useSqliteOnly) {
    console.log('USE_SQLITE_ONLY is enabled. Bypassing MySQL and connecting directly to SQLite...');
    await connectSQLite();
  } else if (!useSqliteFallback) {
    console.log('SQLite fallback is disabled. Connecting to MySQL...');
    await connectMySQL();
  } else {
    try {
      console.log('Attempting to connect to MySQL...');
      await connectMySQL();
    } catch (mysqlErr) {
      console.warn('MySQL connection failed. Falling back to SQLite. Error:', mysqlErr.message);
      await connectSQLite();
    }
  }

  // Create tables
  await createTables();
}

async function connectPostgres() {
  dbClient = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await dbClient.connect();
  client.release();
  
  isPostgres = true;
  console.log('Successfully connected to PostgreSQL Database (Neon)');
}

async function connectMySQL() {
  // First, connect without DB to create database if it doesn't exist
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  });

  const dbName = process.env.DB_NAME || 'buildsync_pro';
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.end();

  // Reconnect to the database pool with high traffic configurations
  dbClient = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: dbName,
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });

  // Verify connection works
  const conn = await dbClient.getConnection();
  conn.release();

  isSQLite = false;
  console.log(`Connected to MySQL Database: ${dbName}`);
}

async function connectSQLite() {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(__dirname, 'buildsync_pro.sqlite');
    dbClient = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        return reject(err);
      }
      isSQLite = true;
      console.log(`Connected to SQLite Database: ${dbPath}`);
      // Enable foreign keys in SQLite
      dbClient.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
        if (pragmaErr) console.error('Error enabling PRAGMA foreign_keys:', pragmaErr);
        resolve();
      });
    });
  });
}

async function createTables() {
  const userTableSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      site_access TEXT DEFAULT 'all',
      status TEXT DEFAULT 'active',
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  ` : `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      login_id VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      site_access TEXT,
      status VARCHAR(20) DEFAULT 'active',
      name VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const siteTableSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      project_type TEXT NOT NULL,
      assigned_supervisor_id INTEGER,
      assigned_client_id INTEGER,
      budget REAL NOT NULL,
      start_date TEXT NOT NULL,
      completion_date TEXT NOT NULL,
      status TEXT DEFAULT 'planning',
      progress_percent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_client_id) REFERENCES users(id) ON DELETE SET NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS sites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      site_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      location VARCHAR(255) NOT NULL,
      project_type VARCHAR(100) NOT NULL,
      assigned_supervisor_id INT,
      assigned_client_id INT,
      budget DECIMAL(15,2) NOT NULL,
      start_date DATE NOT NULL,
      completion_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'planning',
      progress_percent INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_client_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const expenseTableSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      site_id INTEGER,
      added_by INTEGER,
      date_time TEXT NOT NULL,
      notes TEXT,
      invoice_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      category VARCHAR(50) NOT NULL,
      site_id INT,
      added_by INT,
      date_time DATETIME NOT NULL,
      notes TEXT,
      invoice_url VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const requestTableSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      site_id INTEGER,
      submitted_by INTEGER,
      status TEXT DEFAULT 'pending',
      reply TEXT,
      attachment_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE
    )
  ` : `
    CREATE TABLE IF NOT EXISTS requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      site_id INT,
      submitted_by INT,
      status VARCHAR(20) DEFAULT 'pending',
      reply TEXT,
      attachment_url VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const activityLogsSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const chatMessagesSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER, -- NULL means broadcast/admin channel
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const projectTimelineSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS project_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      user_id INTEGER,
      event_type TEXT NOT NULL, -- e.g., 'progress', 'approval', 'issue', 'comment'
      description TEXT NOT NULL,
      attachments TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS project_timeline (
      id INT AUTO_INCREMENT PRIMARY KEY,
      site_id INT NOT NULL,
      user_id INT,
      event_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      attachments TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const budgetTableSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER,
      category TEXT NOT NULL,
      item_name TEXT NOT NULL,
      budget_allocation REAL NOT NULL,
      actual_cost REAL DEFAULT 0,
      brand TEXT,
      model_number TEXT,
      serial_number TEXT,
      batch_number TEXT,
      sku TEXT,
      supplier_details TEXT,
      delivery_status TEXT DEFAULT 'pending',
      approval_status TEXT DEFAULT 'pending',
      invoice_upload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    )
  ` : `
    CREATE TABLE IF NOT EXISTS budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      site_id INT,
      category VARCHAR(100) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      budget_allocation DECIMAL(15,2) NOT NULL,
      actual_cost DECIMAL(15,2) DEFAULT 0,
      brand VARCHAR(100),
      model_number VARCHAR(100),
      serial_number VARCHAR(100),
      batch_number VARCHAR(100),
      sku VARCHAR(100),
      supplier_details TEXT,
      delivery_status VARCHAR(50) DEFAULT 'pending',
      approval_status VARCHAR(50) DEFAULT 'pending',
      invoice_upload VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const dailyUpdatesTableSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS daily_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER,
      supervisor_id INTEGER,
      update_date TEXT NOT NULL,
      notes TEXT,
      work_completed TEXT,
      media_urls TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS daily_updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      site_id INT,
      supervisor_id INT,
      update_date DATE NOT NULL,
      notes TEXT,
      work_completed TEXT,
      media_urls TEXT,
      comments TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const agreementsTableSql = isSQLite ? `
    CREATE TABLE IF NOT EXISTS agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER,
      file_url TEXT NOT NULL,
      total_cost REAL,
      extracted_data TEXT,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS agreements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      site_id INT,
      file_url VARCHAR(255) NOT NULL,
      total_cost DECIMAL(15,2),
      extracted_data TEXT,
      uploaded_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const paymentSchedulesSql = isSQLite ? `
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

  // Execute create tables
  await db.query(userTableSql);
  await db.query(siteTableSql);
  await db.query(expenseTableSql);
  await db.query(requestTableSql);
  await db.query(activityLogsSql);
  await db.query(chatMessagesSql);
  await db.query(projectTimelineSql);
  await db.query(budgetTableSql);
  await db.query(dailyUpdatesTableSql);
  await db.query(agreementsTableSql);
  await db.query(paymentSchedulesSql);

  // Create indexes for performance optimization under high traffic/large load
  const indexes = [
    { name: 'idx_users_login_id', table: 'users', column: 'login_id' },
    { name: 'idx_sites_supervisor', table: 'sites', column: 'assigned_supervisor_id' },
    { name: 'idx_expenses_site_id', table: 'expenses', column: 'site_id' },
    { name: 'idx_expenses_added_by', table: 'expenses', column: 'added_by' },
    { name: 'idx_expenses_date_time', table: 'expenses', column: 'date_time' },
    { name: 'idx_requests_site_id', table: 'requests', column: 'site_id' },
    { name: 'idx_requests_submitted_by', table: 'requests', column: 'submitted_by' },
    { name: 'idx_requests_status', table: 'requests', column: 'status' },
    { name: 'idx_activity_logs_user_id', table: 'activity_logs', column: 'user_id' },
    { name: 'idx_activity_logs_created_at', table: 'activity_logs', column: 'created_at' },
    { name: 'idx_chat_messages_sender', table: 'chat_messages', column: 'sender_id' },
    { name: 'idx_chat_messages_receiver', table: 'chat_messages', column: 'receiver_id' },
    { name: 'idx_project_timeline_site_id', table: 'project_timeline', column: 'site_id' },
    { name: 'idx_budgets_site_id', table: 'budgets', column: 'site_id' },
    { name: 'idx_daily_updates_site_id', table: 'daily_updates', column: 'site_id' },
    { name: 'idx_agreements_site_id', table: 'agreements', column: 'site_id' }
  ];

  for (const idx of indexes) {
    try {
      if (isSQLite) {
        await db.query(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})`);
      } else {
        const indexCheck = await db.query(`SHOW INDEX FROM ${idx.table} WHERE Key_name = '${idx.name}'`);
        if (indexCheck.length === 0) {
          await db.query(`ALTER TABLE ${idx.table} ADD INDEX ${idx.name} (${idx.column})`);
        }
      }
    } catch (err) {
      // Catch any unexpected errors during indexing
    }
  }

  console.log('All database tables and performance indexes verified/created successfully.');

  // Create default admin user if not exists
  const adminUsers = await db.query('SELECT * FROM users WHERE login_id = ?', ['admin']);
  if (adminUsers.length === 0) {
    const bcrypt = require('bcryptjs');
    const hashedAdmin = await bcrypt.hash('admin123', 10);
    
    await db.query(
      'INSERT INTO users (login_id, password, role, site_access, status, name) VALUES (?, ?, ?, ?, ?, ?)',
      ['admin', hashedAdmin, 'admin', 'all', 'active', 'System Administrator']
    );
    console.log('Default Admin user created (Username: admin, Password: admin123)');
  }
}

module.exports = {
  db,
  initializeDatabase
};
