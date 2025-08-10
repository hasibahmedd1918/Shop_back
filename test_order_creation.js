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

async function testOrderCreation() {
  console.log(`${colors.magenta}${colors.bright}🧪 ORDER CREATION TEST SUITE${colors.reset}\n`);
  console.log(`${colors.yellow}This test will help identify where order creation is failing${colors.reset}\n`);

  try {
    // Test 1: Check if user has a cart
    logTest('🧪 TEST 1', 'Checking if user has a cart');
    const getCartResponse = await makeRequest('GET', '/api/cart', null, TEST_USER_TOKEN);
    logTest('📊 CART RESPONSE', `Status: ${getCartResponse.statusCode}`, getCartResponse.data);
    console.log('');

    // Test 2: Add a product to cart (if cart is empty)
    if (getCartResponse.statusCode === 200 && (!getCartResponse.data.data.items || getCartResponse.data.data.items.length === 0)) {
      logTest('🧪 TEST 2', 'Adding product to cart (cart was empty)');
      const addItemData = {
        productId: '507f1f77bcf86cd799439011', // Replace with actual product ID
        quantity: 2,
        size: 'M',
        color: 'Blue'
      };
      const addItemResponse = await makeRequest('POST', '/api/cart/items', addItemData, TEST_USER_TOKEN);
      logTest('📊 ADD ITEM RESPONSE', `Status: ${addItemResponse.statusCode}`, addItemResponse.data);
      console.log('');
    }

    // Test 3: Try to create order with missing shipping address
    logTest('🧪 TEST 3', 'Testing order creation with missing shipping address (should fail validation)');
    const invalidOrderData = {
      paymentMethod: 'credit_card'
    };
    const invalidOrderResponse = await makeRequest('POST', '/api/orders', invalidOrderData, TEST_USER_TOKEN);
    logTest('📊 INVALID ORDER RESPONSE', `Status: ${invalidOrderResponse.statusCode}`, invalidOrderResponse.data);
    console.log('');

    // Test 4: Try to create order with invalid payment method
    logTest('🧪 TEST 4', 'Testing order creation with invalid payment method (should fail validation)');
    const invalidPaymentData = {
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      },
      paymentMethod: 'invalid_method'
    };
    const invalidPaymentResponse = await makeRequest('POST', '/api/orders', invalidPaymentData, TEST_USER_TOKEN);
    logTest('📊 INVALID PAYMENT RESPONSE', `Status: ${invalidPaymentResponse.statusCode}`, invalidPaymentResponse.data);
    console.log('');

    // Test 5: Try to create order with mobile banking but missing mobile number
    logTest('🧪 TEST 5', 'Testing order creation with mobile banking but missing mobile number (should fail validation)');
    const invalidMobileData = {
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      },
      paymentMethod: 'bkash'
    };
    const invalidMobileResponse = await makeRequest('POST', '/api/orders', invalidMobileData, TEST_USER_TOKEN);
    logTest('📊 INVALID MOBILE RESPONSE', `Status: ${invalidMobileResponse.statusCode}`, invalidMobileResponse.data);
    console.log('');

    // Test 6: Try to create order with valid data (this should work if cart has items)
    logTest('🧪 TEST 6', 'Testing order creation with valid data');
    const validOrderData = {
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        phone: '+1234567890'
      },
      billingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      },
      paymentMethod: 'credit_card',
      notes: 'Test order from debugging script'
    };
    const validOrderResponse = await makeRequest('POST', '/api/orders', validOrderData, TEST_USER_TOKEN);
    logTest('📊 VALID ORDER RESPONSE', `Status: ${validOrderResponse.statusCode}`, validOrderResponse.data);
    console.log('');

    // Test 7: Try to create order with mobile banking payment
    logTest('🧪 TEST 7', 'Testing order creation with mobile banking payment');
    const mobileOrderData = {
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        phone: '+1234567890'
      },
      paymentMethod: 'bkash',
      mobileNumber: '01712345678',
      transactionNumber: 'TX123456789',
      notes: 'Test mobile banking order'
    };
    const mobileOrderResponse = await makeRequest('POST', '/api/orders', mobileOrderData, TEST_USER_TOKEN);
    logTest('📊 MOBILE ORDER RESPONSE', `Status: ${mobileOrderResponse.statusCode}`, mobileOrderResponse.data);
    console.log('');

    // Test 8: Check cart after order creation
    logTest('🧪 TEST 8', 'Checking cart after order creation (should be empty)');
    const finalCartResponse = await makeRequest('GET', '/api/cart', null, TEST_USER_TOKEN);
    logTest('📊 FINAL CART RESPONSE', `Status: ${finalCartResponse.statusCode}`, finalCartResponse.data);
    console.log('');

    logTest('✅ SUCCESS', 'All order creation tests completed! Check the server console for detailed debug output.');
    
  } catch (error) {
    logTest('❌ ERROR', `Test failed: ${error.message}`);
  }
}

// Test order retrieval
async function testOrderRetrieval() {
  console.log(`${colors.blue}${colors.bright}📋 ORDER RETRIEVAL TESTS${colors.reset}\n`);
  
  try {
    // Test 1: Get user's orders
    logTest('🧪 ORDER LIST TEST', 'Getting user\'s orders');
    const ordersResponse = await makeRequest('GET', '/api/orders', null, TEST_USER_TOKEN);
    logTest('📊 ORDERS RESPONSE', `Status: ${ordersResponse.statusCode}`, ordersResponse.data);
    console.log('');

    // Test 2: Get specific order (if any orders exist)
    if (ordersResponse.statusCode === 200 && ordersResponse.data.data.orders.length > 0) {
      const firstOrder = ordersResponse.data.data.orders[0];
      logTest('🧪 SINGLE ORDER TEST', `Getting specific order: ${firstOrder._id}`);
      const singleOrderResponse = await makeRequest('GET', `/api/orders/${firstOrder._id}`, null, TEST_USER_TOKEN);
      logTest('📊 SINGLE ORDER RESPONSE', `Status: ${singleOrderResponse.statusCode}`, singleOrderResponse.data);
      console.log('');

      // Test 3: Get order tracking
      logTest('🧪 ORDER TRACKING TEST', `Getting tracking for order: ${firstOrder._id}`);
      const trackingResponse = await makeRequest('GET', `/api/orders/${firstOrder._id}/tracking`, null, TEST_USER_TOKEN);
      logTest('📊 TRACKING RESPONSE', `Status: ${trackingResponse.statusCode}`, trackingResponse.data);
      console.log('');
    }

  } catch (error) {
    logTest('❌ ERROR', `Order retrieval test failed: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  console.log(`${colors.magenta}${colors.bright}🚀 STARTING ORDER CREATION TEST SUITE${colors.reset}\n`);
  console.log(`${colors.gray}=====================================${colors.reset}\n`);
  
  await testOrderCreation();
  await testOrderRetrieval();
  
  console.log(`${colors.gray}=====================================${colors.reset}`);
  console.log(`${colors.green}${colors.bright}🎉 ALL TESTS COMPLETED!${colors.reset}`);
  console.log(`${colors.yellow}Check your server console for detailed color-coded debug output.${colors.reset}`);
  console.log(`${colors.cyan}The debug output will show:${colors.reset}`);
  console.log(`${colors.gray}  • Cart fetching and validation${colors.reset}`);
  console.log(`${colors.gray}  • Product availability checks${colors.reset}`);
  console.log(`${colors.gray}  • Stock validation${colors.reset}`);
  console.log(`${colors.gray}  • Order creation process${colors.reset}`);
  console.log(`${colors.gray}  • Stock updates${colors.reset}`);
  console.log(`${colors.gray}  • Cart clearing${colors.reset}`);
  console.log(`${colors.gray}  • Any errors or failures${colors.reset}`);
}

runAllTests(); 