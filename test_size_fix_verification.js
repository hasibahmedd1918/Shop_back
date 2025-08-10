const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = null;
let userId = null;

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User'
};

const testProductWithSizes = {
  name: 'Test T-Shirt',
  description: 'A test t-shirt with sizes',
  price: 29.99,
  brand: 'TestBrand',
  category: 'Clothing',
  sizes: [
    { size: 'S', stock: 10, available: true },
    { size: 'M', stock: 15, available: true },
    { size: 'L', stock: 8, available: true }
  ],
  colors: ['Red', 'Blue'],
  isActive: true
};

const testProductWithoutSizes = {
  name: 'Test Accessory',
  description: 'A test accessory without sizes',
  price: 19.99,
  brand: 'TestBrand',
  category: 'Accessories',
  sizes: [], // No sizes
  colors: ['Black'],
  isActive: true,
  stock: 25 // General stock
};

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    authToken = response.data.token;
    userId = response.data.user._id;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function register() {
  try {
    console.log('📝 Registering new user...');
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('✅ Registration successful');
    return true;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
      console.log('ℹ️ User already exists, proceeding with login');
      return true;
    }
    console.log('❌ Registration failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function addToCart(productId, size = null, quantity = 1) {
  try {
    const payload = {
      productId,
      quantity
    };
    
    if (size) {
      payload.size = size;
    }
    
    const response = await axios.post(`${BASE_URL}/cart/items`, payload, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Added to cart successfully');
    return response.data;
  } catch (error) {
    console.log('❌ Add to cart failed:', error.response?.data?.error || error.message);
    return null;
  }
}

async function getCart() {
  try {
    const response = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Cart retrieved successfully');
    return response.data.data;
  } catch (error) {
    console.log('❌ Get cart failed:', error.response?.data?.error || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Starting Size Fix Verification Tests\n');
  
  // Step 1: Register/Login
  const authSuccess = await register() && await login();
  if (!authSuccess) {
    console.log('❌ Authentication failed, stopping tests');
    return;
  }
  
  // Step 2: Test adding product with "Free Size" (no size specified)
  console.log('\n📦 Test 1: Adding product without specifying size (should use "Free Size")');
  const cart1 = await addToCart('6890cbadfd0efb1ef55aa184'); // Use the product ID from your logs
  if (cart1) {
    console.log('✅ Test 1 PASSED: Product added with "Free Size"');
  } else {
    console.log('❌ Test 1 FAILED: Could not add product with "Free Size"');
  }
  
  // Step 3: Test adding product with specific size
  console.log('\n📦 Test 2: Adding product with specific size');
  const cart2 = await addToCart('6890cbadfd0efb1ef55aa184', 'M', 1);
  if (cart2) {
    console.log('✅ Test 2 PASSED: Product added with specific size');
  } else {
    console.log('❌ Test 2 FAILED: Could not add product with specific size');
  }
  
  // Step 4: Test adding product with invalid size
  console.log('\n📦 Test 3: Adding product with invalid size (should fail)');
  const cart3 = await addToCart('6890cbadfd0efb1ef55aa184', 'INVALID_SIZE', 1);
  if (!cart3) {
    console.log('✅ Test 3 PASSED: Correctly rejected invalid size');
  } else {
    console.log('❌ Test 3 FAILED: Should have rejected invalid size');
  }
  
  // Step 5: Check final cart state
  console.log('\n📦 Test 4: Checking final cart state');
  const finalCart = await getCart();
  if (finalCart) {
    console.log('✅ Test 4 PASSED: Cart retrieved successfully');
    console.log(`📊 Cart contains ${finalCart.items.length} items`);
    finalCart.items.forEach((item, index) => {
      console.log(`   Item ${index + 1}: ${item.product.name} - Size: ${item.size} - Qty: ${item.quantity}`);
    });
  } else {
    console.log('❌ Test 4 FAILED: Could not retrieve cart');
  }
  
  console.log('\n🎉 Size Fix Verification Tests Complete!');
}

// Run the tests
runTests().catch(console.error); 