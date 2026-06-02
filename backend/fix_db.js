const { db, initializeDatabase } = require('./database.js');

async function fix() {
  try {
    await initializeDatabase();
    await db.query('ALTER TABLE sites ADD COLUMN assigned_client_id INTEGER');
    console.log('Added assigned_client_id');
  } catch(e) {
    console.log('Error or already exists: ', e.message);
  }
}

fix();
