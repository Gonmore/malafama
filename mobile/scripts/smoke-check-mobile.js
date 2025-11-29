const axios = require('axios');

// Lightweight smoke-check for mobile-relevant endpoints.
// Usage: node scripts/smoke-check-mobile.js

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/,'') + '/api/v1';

async function run() {
  console.log('API base:', API_BASE);
  try {
    const loginResp = await axios.post(`${API_BASE}/auth/login`, { email: 'admin@malafama.com', password: 'admin123' }, { timeout: 5000 });
    const token = loginResp?.data?.data?.token || loginResp?.data?.token || loginResp?.data?.data?.token;
    if (!token) throw new Error('Login failed / token missing');
    console.log('Login OK — token obtained');

    const headers = { Authorization: `Bearer ${token}` };

    // check locales
    const locales = await axios.get(`${API_BASE}/locales`, { headers, timeout: 5000 });
    const list = locales?.data?.data || locales?.data || [];
    console.log('Locales found:', Array.isArray(list) ? list.length : 'unknown');

    if (Array.isArray(list) && list.length) {
      const id = list[0].id || list[0].localId || list[0].uuid || list[0].name || null;
      if (id) {
        try {
          const mesas = await axios.get(`${API_BASE}/mesas?local=${id}`, { headers, timeout: 5000 });
          const mlist = mesas?.data?.data || mesas?.data || mesas?.data?.mesas || [];
          console.log('Mesas for first local:', Array.isArray(mlist) ? mlist.length : 'unknown');
        } catch (e) {
          // Try alternative query param
          try {
            const mesas2 = await axios.get(`${API_BASE}/mesas?localId=${id}`, { headers, timeout: 5000 });
            const mlist2 = mesas2?.data?.data || mesas2?.data || mesas2?.data?.mesas || [];
            console.log('Mesas for first local (localId):', Array.isArray(mlist2) ? mlist2.length : 'unknown');
          } catch (err) {
            console.warn('Mesas fetch failed (this may be OK if backend does not expose local-scoped mesas)');
          }
        }
      }
    }

    console.log('Smoke checks completed — core endpoints reachable');
  } catch (e) {
    console.error('Smoke check failed:', e.message || e);
    process.exit(1);
  }
}

run();
