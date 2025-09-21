const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
require('dotenv').config();

async function testElevenLabsAPI() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  console.log('Testing ElevenLabs API...');
  console.log('API Key configured:', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET');
  
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY is not set');
    return;
  }
  
  try {
    const client = new ElevenLabsClient({ apiKey });
    
    // Test with a simple API call to get voices
    const voices = await client.voices.getAll();
    console.log('✅ API Key is valid! Found', voices.voices?.length || 0, 'voices');
    
  } catch (error) {
    console.error('❌ API Key test failed:', {
      message: error.message,
      status: error.status,
      statusCode: error.statusCode,
    });
  }
}

testElevenLabsAPI();