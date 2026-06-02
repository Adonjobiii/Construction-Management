const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const token = jwt.sign(
      { id: 1, login_id: 'admin', role: 'admin', name: 'System Administrator', site_access: 'all' },
      'BuildSyncProEnterpriseSuperSecretKey2026!',
      { expiresIn: '12h' }
    );

    const client = axios.create({
      baseURL: 'https://construction-management-1-wf04.onrender.com/api',
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Testing LIVE /sites...');
    try { const r = await client.get('/sites'); console.log('✅ /sites OK, length:', r.data.length); } catch(e) { console.error('❌ /sites error:', e.response?.data || e.message); }
    
    console.log('Testing LIVE /expenses...');
    try { const r = await client.get('/expenses'); console.log('✅ /expenses OK, length:', r.data.length); } catch(e) { console.error('❌ /expenses error:', e.response?.data || e.message); }

    console.log('Testing LIVE /requests...');
    try { const r = await client.get('/requests'); console.log('✅ /requests OK, length:', r.data.length); } catch(e) { console.error('❌ /requests error:', e.response?.data || e.message); }

    console.log('Testing LIVE /chats...');
    try { const r = await client.get('/chats'); console.log('✅ /chats OK, length:', r.data.length); } catch(e) { console.error('❌ /chats error:', e.response?.data || e.message); }

    console.log('Testing LIVE /dashboard-metrics...');
    try { const r = await client.get('/dashboard-metrics'); console.log('✅ /dashboard-metrics OK'); } catch(e) { console.error('❌ /dashboard-metrics error:', e.response?.data || e.message); }

    console.log('Testing LIVE /activity-logs...');
    try { const r = await client.get('/activity-logs'); console.log('✅ /activity-logs OK, length:', r.data.length); } catch(e) { console.error('❌ /activity-logs error:', e.response?.data || e.message); }

    console.log('Testing LIVE /auth/users...');
    try { const r = await client.get('/auth/users'); console.log('✅ /auth/users OK, length:', r.data.length); } catch(e) { console.error('❌ /auth/users error:', e.response?.data || e.message); }

  } catch (err) {
    console.error(err);
  }
})();
