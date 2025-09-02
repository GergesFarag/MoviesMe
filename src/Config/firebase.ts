import admin from "firebase-admin";
import { validateFirebaseCredentials, checkServerTime } from "../Utils/Auth/timeCheck";

if (!admin.apps.length) {
  try {
    // Validate credentials first
    validateFirebaseCredentials();
    
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      // More robust private key handling
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Handle different possible formats of the private key
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // Ensure the key starts and ends with the proper markers
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Invalid private key format: missing BEGIN marker');
      }
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        throw new Error('Invalid private key format: missing END marker');
      }

      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      };

      console.log('Initializing Firebase with project:', process.env.FIREBASE_PROJECT_ID);
      console.log('Client email:', process.env.FIREBASE_CLIENT_EMAIL);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log('Firebase Admin initialized successfully');
      
      // Check server time in development/staging
      if (process.env.NODE_ENV !== 'production') {
        checkServerTime().catch(console.error);
      }
    } else {
      throw new Error('Missing required Firebase environment variables');
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw error;
  }
}

export const firebaseAdmin = admin;