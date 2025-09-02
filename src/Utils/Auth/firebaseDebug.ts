import { firebaseAdmin } from "../../Config/firebase";

/**
 * Debug utility to test Firebase configuration and token handling
 */
export const debugFirebaseAuth = async (token?: string): Promise<void> => {
  console.log('=== Firebase Debug Information ===');
  
  // Check if Firebase is initialized
  if (!firebaseAdmin.apps.length) {
    console.error('❌ Firebase Admin is not initialized');
    return;
  }
  
  console.log('✅ Firebase Admin is initialized');
  console.log('📱 App name:', firebaseAdmin.app().name);
  console.log('🔧 Project ID:', firebaseAdmin.app().options.projectId);
  
  // Check credential type
  const credential = firebaseAdmin.app().options.credential;
  if (credential) {
    console.log('🔐 Credential type:', credential.constructor.name);
  }
  
  // Test basic Firebase operations
  try {
    // Test if we can access Firebase Auth service
    const auth = firebaseAdmin.auth();
    console.log('✅ Firebase Auth service is accessible');
    
    // Test if we can list users (this validates the service account)
    const listUsersResult = await auth.listUsers(1);
    console.log('✅ Firebase service account is valid');
    console.log('👥 Can access user management');
    
  } catch (error: any) {
    console.error('❌ Firebase Auth test failed:', error.message);
    
    if (error.code) {
      console.error('📋 Error code:', error.code);
    }
  }
  
  // If token is provided, test token verification
  if (token) {
    console.log('\n=== Token Verification Test ===');
    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      console.log('✅ Token verification successful');
      console.log('👤 User ID:', decoded.uid);
      console.log('📧 Email:', decoded.email || 'N/A');
      console.log('⏰ Token issued at:', new Date(decoded.iat * 1000).toISOString());
      console.log('⏰ Token expires at:', new Date(decoded.exp * 1000).toISOString());
      
    } catch (error: any) {
      console.error('❌ Token verification failed:', error.message);
      
      if (error.code) {
        console.error('📋 Error code:', error.code);
      }
      
      // Analyze the token structure (first 100 characters)
      console.log('🔍 Token preview:', token.substring(0, 100) + '...');
      
      // Check if it looks like a JWT
      const parts = token.split('.');
      console.log('🔍 Token parts count:', parts.length);
      
      if (parts.length === 3) {
        try {
          const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
          console.log('🔍 Token header:', header);
          
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          console.log('🔍 Token payload keys:', Object.keys(payload));
          console.log('🔍 Token issuer:', payload.iss || 'N/A');
          console.log('🔍 Token audience:', payload.aud || 'N/A');
          
        } catch (parseError) {
          console.error('❌ Could not parse token structure:', parseError);
        }
      }
    }
  }
  
  console.log('=== End Firebase Debug ===\n');
};

/**
 * Middleware to add debug information to requests
 */
export const debugFirebaseMiddleware = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'development') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      debugFirebaseAuth(token).catch(console.error);
    }
  }
  next();
};
