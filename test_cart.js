const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER_TOKEN = 'your-test-jwt-token-here'; // Replace with actual token

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

async function testCartEndpoints() {
  console.log('🧪 Testing Cart Endpoints...\n');

  try {
    // Test 1: Get cart (should create empty cart if none exists)
    console.log('1️⃣ Testing GET /api/cart...');
    const getCartResponse = await makeRequest('GET', '/api/cart', null, TEST_USER_TOKEN);
    console.log('Status:', getCartResponse.statusCode);
    console.log('Response:', JSON.stringify(getCartResponse.data, null, 2));
    console.log('');

    // Test 2: Add item to cart
    console.log('2️⃣ Testing POST /api/cart/items...');
    const addItemData = {
      productId: '507f1f77bcf86cd799439011', // Replace with actual product ID
      quantity: 2,
      size: 'M',
      color: 'Blue'
    };
    const addItemResponse = await makeRequest('POST', '/api/cart/items', addItemData, TEST_USER_TOKEN);
    console.log('Status:', addItemResponse.statusCode);
    console.log('Response:', JSON.stringify(addItemResponse.data, null, 2));
    console.log('');

    // Test 3: Get cart summary
    console.log('3️⃣ Testing GET /api/cart/summary...');
    const summaryResponse = await makeRequest('GET', '/api/cart/summary', null, TEST_USER_TOKEN);
    console.log('Status:', summaryResponse.statusCode);
    console.log('Response:', JSON.stringify(summaryResponse.data, null, 2));
    console.log('');

    // Test 4: Apply coupon
    console.log('4️⃣ Testing POST /api/cart/coupon...');
    const couponData = {
      code: 'WELCOME10'
    };
    const couponResponse = await makeRequest('POST', '/api/cart/coupon', couponData, TEST_USER_TOKEN);
    console.log('Status:', couponResponse.statusCode);
    console.log('Response:', JSON.stringify(couponResponse.data, null, 2));
    console.log('');

    // Test 5: Get cart again to see coupon applied
    console.log('5️⃣ Testing GET /api/cart (after coupon)...');
    const getCartAfterCoupon = await makeRequest('GET', '/api/cart', null, TEST_USER_TOKEN);
    console.log('Status:', getCartAfterCoupon.statusCode);
    console.log('Response:', JSON.stringify(getCartAfterCoupon.data, null, 2));
    console.log('');

    console.log('✅ Cart endpoint tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Test without authentication (should fail)
async function testUnauthenticatedAccess() {
  console.log('🔒 Testing unauthenticated access...\n');
  
  try {
    const response = await makeRequest('GET', '/api/cart');
    console.log('Status:', response.statusCode);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('');
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Cart API Tests\n');
  console.log('=====================================\n');
  
  await testUnauthenticatedAccess();
  await testCartEndpoints();
  
  console.log('=====================================');
  console.log('🎉 All tests completed!');
}

runTests(); 