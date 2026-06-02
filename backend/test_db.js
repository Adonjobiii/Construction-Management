const { initializeDatabase } = require('./database');
(async () => {
  try {
    await initializeDatabase();
    console.log('Test successful');
    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  }
})();
