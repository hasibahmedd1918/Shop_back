const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashion_store')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import Product model
const Product = require('./src/models/Product');

async function listProducts() {
  try {
    console.log('📦 Available Products in Database:\n');
    
    const products = await Product.find({ isActive: true }).limit(10);
    
    if (products.length === 0) {
      console.log('❌ No active products found in database');
      console.log('💡 You may need to add some products first');
      return;
    }

    products.forEach((product, index) => {
      console.log(`${index + 1}. Product ID: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Brand: ${product.brand}`);
      console.log(`   Price: $${product.price}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Gender: ${product.gender}`);
      
      if (product.sizes && product.sizes.length > 0) {
        const availableSizes = product.sizes
          .filter(s => s.available && s.stock > 0)
          .map(s => `${s.size}(${s.stock})`);
        console.log(`   Available Sizes: ${availableSizes.join(', ')}`);
      } else {
        console.log(`   Stock: ${product.stock || 'N/A'}`);
        console.log(`   Type: No specific sizes (Free Size)`);
      }
      console.log('');
    });

    // Show sample curl commands
    console.log('='.repeat(60));
    console.log('🛒 SAMPLE CURL COMMANDS');
    console.log('='.repeat(60));
    
    const sampleProduct = products[0];
    console.log(`\n1. Add product with size (if available):`);
    if (sampleProduct.sizes && sampleProduct.sizes.length > 0) {
      const firstSize = sampleProduct.sizes[0].size;
      console.log(`curl -X POST http://localhost:5000/api/cart/items \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\`);
      console.log(`  -d '{"productId": "${sampleProduct._id}", "quantity": 1, "size": "${firstSize}"}'`);
    }
    
    console.log(`\n2. Add product without size (Free Size):`);
    console.log(`curl -X POST http://localhost:5000/api/cart/items \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\`);
    console.log(`  -d '{"productId": "${sampleProduct._id}", "quantity": 1}'`);
    
    console.log(`\n3. Get cart contents:`);
    console.log(`curl -X GET http://localhost:5000/api/cart \\`);
    console.log(`  -H "Authorization: Bearer YOUR_TOKEN_HERE"`);
    
    console.log(`\n4. Login to get token:`);
    console.log(`curl -X POST http://localhost:5000/api/auth/login \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"email": "your-email@example.com", "password": "your-password"}'`);

  } catch (error) {
    console.error('❌ Error listing products:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the script
listProducts(); 