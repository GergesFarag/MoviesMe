import admin from "firebase-admin";
import fs from "fs";
import path from "path";
const base64ServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!base64ServiceAccountKey) {
  throw new Error(
    "Firebase service account key is missing in environment variables"
  );
}

// Decode the base64 string and write it to a temporary file
const decodedKey = Buffer.from(base64ServiceAccountKey, "base64").toString(
  "utf-8"
);
const keyFilePath = path.join(__dirname, "serviceAccountKey.json");

fs.writeFileSync(keyFilePath, decodedKey);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require(keyFilePath)),
});

// Clean up the temporary key file after initialization (optional)
fs.unlinkSync(keyFilePath);
export const firebaseAdmin = admin;
