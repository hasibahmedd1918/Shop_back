const mongoose = require('mongoose');
const { exec } = require('child_process');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashion_store')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import Product model
const Product = require('./src/models/Product');

async function getProductForCart() {
  try {
    // Find an active product with sizes
    const productWithSizes = await Product.findOne({ 
      isActive: true,
      'sizes.0': { $exists: true },
      'sizes.stock': { $gt: 0 }
    });

    // Find an active product without sizes (accessories)
    const productWithoutSizes = await Product.findOne({ 
      isActive: true,
      sizes: { $size: 0 },
      stock: { $gt: 0 }
    });

    if (productWithSizes) {
      console.log('📦 Found product with sizes:', {
        id: productWithSizes._id,
        name: productWithSizes.name,
        brand: productWithSizes.brand,
        price: productWithSizes.price,
        sizes: productWithSizes.sizes.map(s => `${s.size}(${s.stock})`)
      });
      return {
        productId: productWithSizes._id.toString(),
        name: productWithSizes.name,
        hasSizes: true,
        availableSizes: productWithSizes.sizes.filter(s => s.available && s.stock > 0).map(s => s.size)
      };
    } else if (productWithoutSizes) {
      console.log('📦 Found product without sizes:', {
        id: productWithoutSizes._id,
        name: productWithoutSizes.name,
        brand: productWithoutSizes.brand,
        price: productWithoutSizes.price,
        stock: productWithoutSizes.stock
      });
      return {
        productId: productWithoutSizes._id.toString(),
        name: productWithoutSizes.name,
        hasSizes: false
      };
    } else {
      console.log('❌ No active products found in database');
      return null;
    }
  } catch (error) {
    console.error('❌ Error finding product:', error);
    return null;
  }
}

async function registerUser() {
  const registerData = {
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'TestPassword123!',
    phone: '+1234567890'
  };

  return new Promise((resolve, reject) => {
    const curlCommand = `curl -X POST http://localhost:5000/api/auth/register \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(registerData)}' \\
      -s`;

    console.log('🔐 Registering test user...');
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Registration error:', error);
        reject(error);
        return;
      }

      try {
        const response = JSON.parse(stdout);
        if (response.success && response.token) {
          console.log('✅ User registered successfully');
          resolve(response.token);
        } else {
          console.log('⚠️ Registration response:', response);
          // Try login instead
          loginUser(registerData.email, registerData.password).then(resolve).catch(reject);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse registration response:', parseError);
        reject(parseError);
      }
    });
  });
}

async function loginUser(email, password) {
  const loginData = { email, password };

  return new Promise((resolve, reject) => {
    const curlCommand = `curl -X POST http://localhost:5000/api/auth/login \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(loginData)}' \\
      -s`;

    console.log('🔐 Logging in test user...');
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Login error:', error);
        reject(error);
        return;
      }

      try {
        const response = JSON.parse(stdout);
        if (response.success && response.token) {
          console.log('✅ User logged in successfully');
          resolve(response.token);
        } else {
          console.error('❌ Login failed:', response);
          reject(new Error('Login failed'));
        }
      } catch (parseError) {
        console.error('❌ Failed to parse login response:', parseError);
        reject(parseError);
      }
    });
  });
}

async function addToCart(token, productId, size = null, quantity = 1) {
  const cartData = {
    productId,
    quantity,
    ...(size && { size })
  };

  return new Promise((resolve, reject) => {
    const curlCommand = `curl -X POST http://localhost:5000/api/cart/items \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer ${token}" \\
      -d '${JSON.stringify(cartData)}' \\
      -s`;

    console.log('🛒 Adding product to cart...');
    console.log('📋 Request data:', cartData);
    
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Cart addition error:', error);
        reject(error);
        return;
      }

      try {
        const response = JSON.parse(stdout);
        console.log('📦 Cart response:', response);
        resolve(response);
      } catch (parseError) {
        console.error('❌ Failed to parse cart response:', parseError);
        console.log('Raw response:', stdout);
        reject(parseError);
      }
    });
  });
}

async function getCart(token) {
  return new Promise((resolve, reject) => {
    const curlCommand = `curl -X GET http://localhost:5000/api/cart \\
      -H "Authorization: Bearer ${token}" \\
      -s`;

    console.log('🛒 Getting cart contents...');
    
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Get cart error:', error);
        reject(error);
        return;
      }

      try {
        const response = JSON.parse(stdout);
        console.log('📦 Cart contents:', response);
        resolve(response);
      } catch (parseError) {
        console.error('❌ Failed to parse cart response:', parseError);
        console.log('Raw response:', stdout);
        reject(parseError);
      }
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting curl cart test...\n');

    // Step 1: Get a product from database
    const product = await getProductForCart();
    if (!product) {
      console.log('❌ No products available for testing');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📦 PRODUCT SELECTED FOR TESTING');
    console.log('='.repeat(60));
    console.log(`Product ID: ${product.productId}`);
    console.log(`Product Name: ${product.name}`);
    console.log(`Has Sizes: ${product.hasSizes}`);
    if (product.hasSizes) {
      console.log(`Available Sizes: ${product.availableSizes.join(', ')}`);
    }
    console.log('='.repeat(60) + '\n');

    // Step 2: Get authentication token
    const token = await registerUser();

    // Step 3: Test adding product to cart
    console.log('\n' + '='.repeat(60));
    console.log('🛒 TESTING CART ADDITION');
    console.log('='.repeat(60));

    if (product.hasSizes) {
      // Test with a specific size
      const testSize = product.availableSizes[0];
      console.log(`\n🧪 Test 1: Adding with size "${testSize}"`);
      await addToCart(token, product.productId, testSize, 2);
      
      // Test with invalid size
      console.log(`\n🧪 Test 2: Adding with invalid size "INVALID"`);
      await addToCart(token, product.productId, 'INVALID', 1);
    } else {
      // Test without size (Free Size)
      console.log(`\n🧪 Test 1: Adding without size (Free Size)`);
      await addToCart(token, product.productId, null, 1);
      
      // Test with Free Size explicitly
      console.log(`\n🧪 Test 2: Adding with "Free Size" explicitly`);
      await addToCart(token, product.productId, 'Free Size', 1);
    }

    // Test with invalid product ID
    console.log(`\n🧪 Test 3: Adding with invalid product ID`);
    await addToCart(token, '507f1f77bcf86cd799439999', null, 1);

    // Step 4: Get cart contents
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL CART CONTENTS');
    console.log('='.repeat(60));
    await getCart(token);

    console.log('\n✅ Curl cart test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
main(); 