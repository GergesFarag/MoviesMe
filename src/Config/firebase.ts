import admin, { ServiceAccount } from "firebase-admin";

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      const service_account = require("../../ttov-a9677-firebase-adminsdk-fbsvc-6bd2137180.json");
      admin.initializeApp({
        credential: admin.credential.cert(service_account as ServiceAccount),
      });
      console.log("Firebase Admin initialized successfully with JSON file");
    }
    
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw error;
  }
}

export const firebaseAdmin = admin;