const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    // Generate an admin token matching the one in the app
    const token = jwt.sign(
      { id: 1, login_id: 'admin', role: 'admin', name: 'System Administrator', site_access: 'all' },
      'BuildSyncProEnterpriseSuperSecretKey2026!',
      { expiresIn: '12h' }
    );

    const client = axios.create({
      baseURL: 'http://localhost:5000/api',
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Testing /sites...');
    try { await client.get('/sites'); console.log('✅ /sites OK'); } catch(e) { console.error('❌ /sites error:', e.response?.data || e.message); }
    
    console.log('Testing /expenses...');
    try { await client.get('/expenses'); console.log('✅ /expenses OK'); } catch(e) { console.error('❌ /expenses error:', e.response?.data || e.message); }

    console.log('Testing /requests...');
    try { await client.get('/requests'); console.log('✅ /requests OK'); } catch(e) { console.error('❌ /requests error:', e.response?.data || e.message); }

    console.log('Testing /chats...');
    try { await client.get('/chats'); console.log('✅ /chats OK'); } catch(e) { console.error('❌ /chats error:', e.response?.data || e.message); }

    console.log('Testing /dashboard-metrics...');
    try { await client.get('/dashboard-metrics'); console.log('✅ /dashboard-metrics OK'); } catch(e) { console.error('❌ /dashboard-metrics error:', e.response?.data || e.message); }

    console.log('Testing /activity-logs...');
    try { await client.get('/activity-logs'); console.log('✅ /activity-logs OK'); } catch(e) { console.error('❌ /activity-logs error:', e.response?.data || e.message); }

    console.log('Testing /auth/users...');
    try { await client.get('/auth/users'); console.log('✅ /auth/users OK'); } catch(e) { console.error('❌ /auth/users error:', e.response?.data || e.message); }

  } catch (err) {
    console.error(err);
  }
})();
