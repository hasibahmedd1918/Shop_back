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

async function testCartSizeFix() {
  console.log(`${colors.magenta}${colors.bright}🛒 CART SIZE FIX TEST${colors.reset}\n`);
  console.log(`${colors.yellow}Testing if the cart size issue is fixed${colors.reset}\n`);

  try {
    // Test 1: Add product with "Free Size" (should work now)
    logTest('🧪 TEST 1', 'Testing adding product with "Free Size" (should work now)');
    const addItemData = {
      productId: '507f1f77bcf86cd799439011', // Replace with actual product ID
      quantity: 2,
      size: 'Free Size',
      color: 'Blue'
    };
    const addItemResponse = await makeRequest('POST', '/api/cart/items', addItemData, TEST_USER_TOKEN);
    logTest('📊 ADD ITEM RESPONSE', `Status: ${addItemResponse.statusCode}`, addItemResponse.data);
    console.log('');

    // Test 2: Add product without specifying size (should default to "Free Size")
    logTest('🧪 TEST 2', 'Testing adding product without size (should default to "Free Size")');
    const addItemNoSizeData = {
      productId: '507f1f77bcf86cd799439012', // Replace with different product ID
      quantity: 1,
      color: 'Red'
    };
    const addItemNoSizeResponse = await makeRequest('POST', '/api/cart/items', addItemNoSizeData, TEST_USER_TOKEN);
    logTest('📊 ADD ITEM NO SIZE RESPONSE', `Status: ${addItemNoSizeResponse.statusCode}`, addItemNoSizeResponse.data);
    console.log('');

    // Test 3: Add product with valid size (should work)
    logTest('🧪 TEST 3', 'Testing adding product with valid size (should work)');
    const addItemValidSizeData = {
      productId: '507f1f77bcf86cd799439013', // Replace with product that has sizes
      quantity: 1,
      size: 'M',
      color: 'Green'
    };
    const addItemValidSizeResponse = await makeRequest('POST', '/api/cart/items', addItemValidSizeData, TEST_USER_TOKEN);
    logTest('📊 ADD ITEM VALID SIZE RESPONSE', `Status: ${addItemValidSizeResponse.statusCode}`, addItemValidSizeResponse.data);
    console.log('');

    // Test 4: Add product with invalid size (should fail)
    logTest('🧪 TEST 4', 'Testing adding product with invalid size (should fail)');
    const addItemInvalidSizeData = {
      productId: '507f1f77bcf86cd799439013', // Replace with product that has sizes
      quantity: 1,
      size: 'INVALID_SIZE',
      color: 'Yellow'
    };
    const addItemInvalidSizeResponse = await makeRequest('POST', '/api/cart/items', addItemInvalidSizeData, TEST_USER_TOKEN);
    logTest('📊 ADD ITEM INVALID SIZE RESPONSE', `Status: ${addItemInvalidSizeResponse.statusCode}`, addItemInvalidSizeResponse.data);
    console.log('');

    // Test 5: Check cart contents
    logTest('🧪 TEST 5', 'Checking cart contents');
    const getCartResponse = await makeRequest('GET', '/api/cart', null, TEST_USER_TOKEN);
    logTest('📊 GET CART RESPONSE', `Status: ${getCartResponse.statusCode}`, getCartResponse.data);
    console.log('');

    // Test 6: Update item quantity
    if (getCartResponse.statusCode === 200 && getCartResponse.data.data.items.length > 0) {
      const firstItem = getCartResponse.data.data.items[0];
      logTest('🧪 TEST 6', `Updating quantity for item: ${firstItem._id}`);
      const updateData = {
        quantity: 3
      };
      const updateResponse = await makeRequest('PUT', `/api/cart/items/${firstItem._id}`, updateData, TEST_USER_TOKEN);
      logTest('📊 UPDATE ITEM RESPONSE', `Status: ${updateResponse.statusCode}`, updateResponse.data);
      console.log('');
    }

    // Summary
    if (addItemResponse.statusCode === 200 || addItemResponse.statusCode === 201) {
      logTest('✅ SUCCESS', 'Cart size issue is fixed! Products can be added with "Free Size"');
      console.log(`${colors.green}The fix was successful. Users can now add products to cart.${colors.reset}`);
    } else {
      logTest('❌ ERROR', 'Cart size issue is still present');
      console.log(`${colors.red}The fix may not have been applied correctly.${colors.reset}`);
    }
    
  } catch (error) {
    logTest('❌ ERROR', `Test failed: ${error.message}`);
  }
}

// Run the test
testCartSizeFix(); 