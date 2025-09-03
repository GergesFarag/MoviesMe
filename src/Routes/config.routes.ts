import { Router } from "express";

const configRouter = Router();

// Endpoint to serve Firebase client configuration
configRouter.get("/firebase", (req, res) => {
  try {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: process.env.FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    };

    // Remove any undefined values
    const cleanConfig = Object.fromEntries(
      Object.entries(firebaseConfig).filter(([_, value]) => value !== undefined)
    );

    res.json(cleanConfig);
  } catch (error) {
    console.error('Error serving Firebase config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

export default configRouter;
