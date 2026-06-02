const { db, initializeDatabase } = require('./database.js');

async function fix() {
  try {
    await initializeDatabase();
    await db.query('ALTER TABLE daily_updates ADD COLUMN comments TEXT');
    console.log('Added comments column');
  } catch(e) {
    console.log('Error or already exists: ', e.message);
  }
}

fix();
