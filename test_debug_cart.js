const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER_TOKEN = 'your-test-jwt-token-here'; // Replace with actual token

// Color codes for test output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

function logTest(prefix, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`${colors.cyan}${colors.bright}[${timestamp}] ${prefix}${colors.reset} ${message}`);
  if (data) {
    console.log(`${colors.gray}${JSON.stringify(data, null, 2)}${colors.reset}`);
  }
}

async function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) }),
        ...(token && { 'Authorization': `Bearer ${token}` })
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

async function testCartDebugging() {
  console.log(`${colors.magenta}${colors.bright}🧪 CART DEBUGGING TEST SUITE${colors.reset}\n`);
  console.log(`${colors.yellow}This test demonstrates the new color-based debugging features${colors.reset}\n`);

  try {
    // Test 1: Get cart (should create empty cart if none exists)
    logTest('🧪 TEST 1', 'Testing GET /api/cart (should create empty cart)');
    const getCartResponse = await makeRequest('GET', '/api/cart', null, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${getCartResponse.statusCode}`, getCartResponse.data);
    console.log('');

    // Test 2: Add item to cart with invalid product ID (should show validation error)
    logTest('🧪 TEST 2', 'Testing POST /api/cart/items with invalid product ID (should show validation error)');
    const invalidAddData = {
      productId: 'invalid-id',
      quantity: 2,
      size: 'M',
      color: 'Blue'
    };
    const invalidAddResponse = await makeRequest('POST', '/api/cart/items', invalidAddData, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${invalidAddResponse.statusCode}`, invalidAddResponse.data);
    console.log('');

    // Test 3: Add item to cart with valid data but non-existent product
    logTest('🧪 TEST 3', 'Testing POST /api/cart/items with non-existent product (should show product not found)');
    const nonExistentAddData = {
      productId: '507f1f77bcf86cd799439011',
      quantity: 2,
      size: 'M',
      color: 'Blue'
    };
    const nonExistentAddResponse = await makeRequest('POST', '/api/cart/items', nonExistentAddData, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${nonExistentAddResponse.statusCode}`, nonExistentAddResponse.data);
    console.log('');

    // Test 4: Apply invalid coupon
    logTest('🧪 TEST 4', 'Testing POST /api/cart/coupon with invalid code (should show invalid coupon error)');
    const invalidCouponData = {
      code: 'INVALID123'
    };
    const invalidCouponResponse = await makeRequest('POST', '/api/cart/coupon', invalidCouponData, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${invalidCouponResponse.statusCode}`, invalidCouponResponse.data);
    console.log('');

    // Test 5: Apply valid coupon to empty cart
    logTest('🧪 TEST 5', 'Testing POST /api/cart/coupon with valid code on empty cart (should show empty cart error)');
    const validCouponData = {
      code: 'WELCOME10'
    };
    const validCouponResponse = await makeRequest('POST', '/api/cart/coupon', validCouponData, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${validCouponResponse.statusCode}`, validCouponResponse.data);
    console.log('');

    // Test 6: Get cart summary
    logTest('🧪 TEST 6', 'Testing GET /api/cart/summary (should show empty cart summary)');
    const summaryResponse = await makeRequest('GET', '/api/cart/summary', null, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${summaryResponse.statusCode}`, summaryResponse.data);
    console.log('');

    // Test 7: Try to update non-existent item
    logTest('🧪 TEST 7', 'Testing PUT /api/cart/items/non-existent-id (should show item not found)');
    const updateData = {
      quantity: 3
    };
    const updateResponse = await makeRequest('PUT', '/api/cart/items/non-existent-id', updateData, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${updateResponse.statusCode}`, updateResponse.data);
    console.log('');

    // Test 8: Try to remove non-existent item
    logTest('🧪 TEST 8', 'Testing DELETE /api/cart/items/non-existent-id (should show item not found)');
    const removeResponse = await makeRequest('DELETE', '/api/cart/items/non-existent-id', null, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${removeResponse.statusCode}`, removeResponse.data);
    console.log('');

    // Test 9: Clear cart
    logTest('🧪 TEST 9', 'Testing DELETE /api/cart (should clear cart)');
    const clearResponse = await makeRequest('DELETE', '/api/cart', null, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${clearResponse.statusCode}`, clearResponse.data);
    console.log('');

    // Test 10: Remove coupon from empty cart
    logTest('🧪 TEST 10', 'Testing DELETE /api/cart/coupon (should show cart not found)');
    const removeCouponResponse = await makeRequest('DELETE', '/api/cart/coupon', null, TEST_USER_TOKEN);
    logTest('📊 RESPONSE', `Status: ${removeCouponResponse.statusCode}`, removeCouponResponse.data);
    console.log('');

    logTest('✅ SUCCESS', 'All debugging tests completed! Check the server console for color-coded debug output.');
    
  } catch (error) {
    logTest('❌ ERROR', `Test failed: ${error.message}`);
  }
}

// Test without authentication (should fail)
async function testUnauthenticatedAccess() {
  console.log(`${colors.red}${colors.bright}🔒 TESTING UNAUTHENTICATED ACCESS${colors.reset}\n`);
  
  try {
    logTest('🧪 UNAUTH TEST', 'Testing GET /api/cart without authentication (should fail)');
    const response = await makeRequest('GET', '/api/cart');
    logTest('📊 RESPONSE', `Status: ${response.statusCode}`, response.data);
    console.log('');
  } catch (error) {
    logTest('❌ ERROR', `Unauthenticated test failed: ${error.message}`);
  }
}

// Performance test
async function testPerformance() {
  console.log(`${colors.blue}${colors.bright}⏱️ PERFORMANCE TEST${colors.reset}\n`);
  
  try {
    const startTime = Date.now();
    
    // Make multiple requests to test performance
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(makeRequest('GET', '/api/cart', null, TEST_USER_TOKEN));
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logTest('⏱️ PERFORMANCE', `5 concurrent requests completed in ${duration}ms`, {
      averageTime: duration / 5,
      totalRequests: 5,
      successfulRequests: results.filter(r => r.statusCode === 200).length
    });
    console.log('');
    
  } catch (error) {
    logTest('❌ ERROR', `Performance test failed: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  console.log(`${colors.magenta}${colors.bright}🚀 STARTING CART DEBUGGING TEST SUITE${colors.reset}\n`);
  console.log(`${colors.gray}=====================================${colors.reset}\n`);
  
  await testUnauthenticatedAccess();
  await testCartDebugging();
  await testPerformance();
  
  console.log(`${colors.gray}=====================================${colors.reset}`);
  console.log(`${colors.green}${colors.bright}🎉 ALL TESTS COMPLETED!${colors.reset}`);
  console.log(`${colors.yellow}Check your server console for detailed color-coded debug output.${colors.reset}`);
  console.log(`${colors.cyan}The debug output will show:${colors.reset}`);
  console.log(`${colors.gray}  • Request details with timestamps${colors.reset}`);
  console.log(`${colors.gray}  • Response status and data${colors.reset}`);
  console.log(`${colors.gray}  • Validation errors in red${colors.reset}`);
  console.log(`${colors.gray}  • Success messages in green${colors.reset}`);
  console.log(`${colors.gray}  • Warning messages in yellow${colors.reset}`);
  console.log(`${colors.gray}  • Info messages in blue${colors.reset}`);
  console.log(`${colors.gray}  • Debug messages in cyan${colors.reset}`);
}

runAllTests(); 