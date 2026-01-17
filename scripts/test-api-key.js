// Test Gemini API key validity
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function testKey() {
  // Try to get key from env or use the one configured in DO
  const key = process.env.GEMINI_API_KEY;
  
  if (!key) {
    console.log('No GEMINI_API_KEY in local .env.local');
    console.log('The key is configured in DigitalOcean environment variables.');
    console.log('\nTo test, please provide your Gemini API key:');
    console.log('  GEMINI_API_KEY=your-key node scripts/test-api-key.js');
    return;
  }
  
  console.log('Testing API key:', key.substring(0, 10) + '...');
  
  const genAI = new GoogleGenerativeAI(key);
  
  // Try listing models first
  const models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'];
  
  for (const modelName of models) {
    try {
      console.log(`\nTrying ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say hello');
      console.log('✅ SUCCESS with', modelName);
      console.log('Response:', result.response.text().substring(0, 50));
      return;
    } catch (e) {
      console.log('❌', e.message.substring(0, 80));
    }
  }
  
  console.log('\n⚠️  All models failed. The API key may be invalid or expired.');
  console.log('Please generate a new key at: https://aistudio.google.com/app/apikey');
}

testKey();
