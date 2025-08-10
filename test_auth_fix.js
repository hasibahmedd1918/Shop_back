const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';

// Color codes for test output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function logTest(prefix, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`${colors.cyan}${colors.bright}[${timestamp}] ${prefix}${colors.reset} ${message}`);
  if (data) {
    console.log(`${colors.gray}${JSON.stringify(data, null, 2)}${colors.reset}`);
  }
}

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testAuthEndpoints() {
  console.log(`${colors.magenta}${colors.bright}🔐 AUTH ENDPOINT FIX TEST${colors.reset}\n`);
  console.log(`${colors.yellow}Testing if the registration endpoint is now accessible${colors.reset}\n`);

  try {
    // Test 1: Test registration endpoint (should work now)
    logTest('🧪 TEST 1', 'Testing POST /api/auth/register (should work now)');
    const registerData = {
      firstName: 'Test',
      lastName: 'User',
      email: `test${Date.now()}@example.com`,
      password: 'password123',
      phone: '+1234567890'
    };
    const registerResponse = await makeRequest('POST', '/api/auth/register', registerData);
    logTest('📊 REGISTER RESPONSE', `Status: ${registerResponse.statusCode}`, registerResponse.data);
    console.log('');

    // Test 2: Test login endpoint (should work)
    logTest('🧪 TEST 2', 'Testing POST /api/auth/login (should work)');
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };
    const loginResponse = await makeRequest('POST', '/api/auth/login', loginData);
    logTest('📊 LOGIN RESPONSE', `Status: ${loginResponse.statusCode}`, loginResponse.data);
    console.log('');

    // Test 3: Test invalid registration data (should fail validation)
    logTest('🧪 TEST 3', 'Testing registration with invalid data (should fail validation)');
    const invalidRegisterData = {
      firstName: 'T', // Too short
      lastName: 'U', // Too short
      email: 'invalid-email',
      password: '123' // Too short
    };
    const invalidRegisterResponse = await makeRequest('POST', '/api/auth/register', invalidRegisterData);
    logTest('📊 INVALID REGISTER RESPONSE', `Status: ${invalidRegisterResponse.statusCode}`, invalidRegisterResponse.data);
    console.log('');

    // Test 4: Test duplicate email (should fail)
    if (registerResponse.statusCode === 201) {
      logTest('🧪 TEST 4', 'Testing registration with duplicate email (should fail)');
      const duplicateData = {
        firstName: 'Another',
        lastName: 'User',
        email: registerData.email, // Same email as above
        password: 'password123',
        phone: '+1234567890'
      };
      const duplicateResponse = await makeRequest('POST', '/api/auth/register', duplicateData);
      logTest('📊 DUPLICATE EMAIL RESPONSE', `Status: ${duplicateResponse.statusCode}`, duplicateResponse.data);
      console.log('');
    }

    // Summary
    if (registerResponse.statusCode === 201) {
      logTest('✅ SUCCESS', 'Registration endpoint is now working correctly!');
      console.log(`${colors.green}The fix was successful. Users can now register.${colors.reset}`);
    } else {
      logTest('❌ ERROR', 'Registration endpoint is still not working');
      console.log(`${colors.red}The fix may not have been applied correctly.${colors.reset}`);
    }
    
  } catch (error) {
    logTest('❌ ERROR', `Test failed: ${error.message}`);
  }
}

// Run the test
testAuthEndpoints(); 