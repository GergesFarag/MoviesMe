/**
 * Utility to check server time synchronization
 * Firebase JWT tokens are time-sensitive and require proper server time
 */

export const checkServerTime = async (): Promise<void> => {
  try {
    // Get server time
    const serverTime = new Date();
    
    // Get time from a reliable source (World Time API)
    const response = await fetch('http://worldtimeapi.org/api/timezone/UTC');
    const data = await response.json();
    const actualTime = new Date(data.utc_datetime);
    
    const timeDifference = Math.abs(serverTime.getTime() - actualTime.getTime());
    const timeDifferenceInSeconds = timeDifference / 1000;
    
    console.log('Server time:', serverTime.toISOString());
    console.log('Actual UTC time:', actualTime.toISOString());
    console.log('Time difference (seconds):', timeDifferenceInSeconds);
    
    // Firebase typically allows up to 5 minutes of clock skew
    if (timeDifferenceInSeconds > 300) {
      console.warn(`Server time is off by ${timeDifferenceInSeconds} seconds!`);
      console.warn('This may cause Firebase authentication issues.');
    } else {
      console.log('Server time is properly synchronized.');
    }
    
  } catch (error) {
    console.error('Could not check server time:', error);
  }
};

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
