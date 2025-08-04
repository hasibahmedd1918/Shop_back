// Environment Variables Check Script for Railway
console.log('🔍 Railway Environment Variables Check');
console.log('=====================================');

const requiredVars = [
  'MONGODB_URI',
  'DATABASE_URL', 
  'JWT_SECRET',
  'GEMINI_API_KEY',
  'PORT',
  'NODE_ENV'
];

const optionalVars = [
  'CORS_ORIGIN',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'JWT_EXPIRE'
];

console.log('\n📋 Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: Set (${value.substring(0, 10)}...)`);
  } else {
    console.log(`❌ ${varName}: Not set`);
  }
});

console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: Set (${value})`);
  } else {
    console.log(`⚠️  ${varName}: Not set (optional)`);
  }
});

console.log('\n🔧 Railway Deployment Tips:');
console.log('1. Go to Railway Dashboard > Your Project > Variables');
console.log('2. Add these required variables:');
console.log('   - MONGODB_URI (or DATABASE_URL)');
console.log('   - JWT_SECRET');
console.log('   - GEMINI_API_KEY');
console.log('3. Railway automatically sets PORT and NODE_ENV');

console.log('\n🚀 To deploy:');
console.log('railway up'); 