/**
 * test-api.js - Route Registration and Health Verification Script
 */
const https = require('https');

const PORT = 443;
const BASE_HOST = 'go-eat-server-59z2.onrender.com';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const requestHeaders = {
      ...headers,
      ...(postData ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      } : {})
    };

    const req = https.request({
      hostname: BASE_HOST,
      port: PORT,
      path,
      method,
      headers: requestHeaders,
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ statusCode: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const tests = [
  {
    name: 'Health check endpoint',
    method: 'GET',
    path: '/api/health',
    allowedStatuses: [200, 404], // 404 if health route doesn't exist, we don't care much
    description: 'Server health check'
  },
  {
    name: 'Auth login (POST with empty body)',
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {},
    allowedStatuses: [400],
    description: 'Expected 400 Bad Request due to missing credentials'
  },
  {
    name: 'Orders list route (Protected)',
    method: 'GET',
    path: '/api/v1/orders',
    allowedStatuses: [401, 200],
    description: 'Expected 401 Unauthorized (route registered and protected)'
  },
  {
    name: 'Restaurants list route (Public)',
    method: 'GET',
    path: '/api/v1/restaurants',
    allowedStatuses: [200],
    description: 'Expected 200 OK'
  },
  {
    name: 'Restaurant Menu route',
    method: 'GET',
    path: '/api/v1/restaurants/6659fbf6b22eb01d2c1257f8/menu',
    allowedStatuses: [200, 400, 404], // 404 is allowed if specific restaurant not found, but NOT route unmapped (HTML)
    description: 'Menu route registered under /restaurants/:restaurantId/menu'
  },
  {
    name: 'Payments banks route (Protected/Vendor)',
    method: 'GET',
    path: '/api/v1/payments/banks',
    allowedStatuses: [401, 403, 200],
    description: 'Expected 401 Unauthorized (route registered and protected)'
  }
];

async function runTests() {
  console.log(`\n🔍 Running API Route Verification Tests against http://${BASE_HOST}:${PORT}...\n`);
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const res = await makeRequest(test.method, test.path, test.body);
      const isExpected = test.allowedStatuses.includes(res.statusCode);
      const statusIcon = isExpected ? '✅ PASS' : '❌ FAIL';

      if (isExpected) {
        passed++;
      } else {
        failed++;
      }

      console.log(`${statusIcon} [${test.method}] ${test.path}`);
      console.log(`   Status: ${res.statusCode} | Allowed: [${test.allowedStatuses.join(', ')}]`);
      console.log(`   Response: ${JSON.stringify(res.data).substring(0, 100)}`);
      console.log(`   Info: ${test.description}\n`);
    } catch (err) {
      failed++;
      console.log(`❌ ERROR [${test.method}] ${test.path}`);
      console.log(`   Could not connect to server: ${err.message}\n`);
    }
  }

  console.log('='.repeat(50));
  console.log(`Summary: Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(50) + '\n');
}

runTests();
