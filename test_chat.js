const https = require('https');
const http = require('http');

async function testChat() {
  try {
    console.log('🧪 Testing Chat Endpoint...');
    
    const postData = JSON.stringify({
      message: 'Hello, can you help me find traditional Indian clothing?',
      context: {}
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log('📊 Response Status:', res.statusCode);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          console.log('📝 Response Data:', JSON.stringify(responseData, null, 2));
          
          if (responseData.success) {
            console.log('✅ Chat test successful!');
            console.log('🤖 AI Response:', responseData.data.response);
            if (responseData.data.products) {
              console.log('🛍️ Products found:', responseData.data.products.length);
            }
            if (responseData.data.suggestions) {
              console.log('💡 Suggestions:', responseData.data.suggestions);
            }
          } else {
            console.log('❌ Chat test failed:', responseData.error);
          }
        } catch (error) {
          console.error('🚨 JSON parse error:', error.message);
          console.log('Raw response:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('🚨 Request error:', error.message);
    });

    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('🚨 Test error:', error.message);
  }
}

testChat(); 