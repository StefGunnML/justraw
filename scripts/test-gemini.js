require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found');
    return;
  }
  console.log('API Key (first 10 chars):', apiKey.substring(0, 10) + '...');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try different model names
  const models = ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'models/gemini-pro', 'models/gemini-1.5-flash'];
  
  for (const modelName of models) {
    console.log(`\nTrying model: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say "Hello"');
      console.log('✅ SUCCESS:', result.response.text().substring(0, 50));
      return; // Exit on first success
    } catch (e) {
      console.log('❌ FAILED:', e.message);
    }
  }
}
test();
