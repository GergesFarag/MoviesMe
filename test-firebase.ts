require('dotenv').config();

// Test Firebase environment variables
console.log('Testing Firebase Environment Variables:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || 'Missing');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL || 'Missing');
console.log('FIREBASE_PRIVATE_KEY length:', process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 'Missing');
console.log('FIREBASE_CLIENT_ID:', process.env.FIREBASE_CLIENT_ID || 'Missing');
