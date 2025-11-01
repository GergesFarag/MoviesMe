
export const validateFirebaseCredentials = (): void => {
  const requiredVars = ['FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PROJECT_ID'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing Firebase environment variables: ${missing.join(', ')}`);
  }
  
  // Check private key format
  const privateKey = process.env.FIREBASE_PRIVATE_KEY!;
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
      !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('FIREBASE_PRIVATE_KEY appears to be malformed');
  }
  
  // Check email format
  const email = process.env.FIREBASE_CLIENT_EMAIL!;
  if (!email.includes('@') || !email.includes('.gserviceaccount.com')) {
    throw new Error('FIREBASE_CLIENT_EMAIL appears to be malformed');
  }
  
  // Check if private key ID is provided (recommended)
  if (!process.env.FIREBASE_PRIVATE_KEY_ID) {
    console.warn('⚠️  FIREBASE_PRIVATE_KEY_ID is not set - this may cause token verification issues');
  } else {
    console.log('✅ FIREBASE_PRIVATE_KEY_ID is set:', process.env.FIREBASE_PRIVATE_KEY_ID);
  }
  
  console.log('Firebase credentials validation passed');
};
