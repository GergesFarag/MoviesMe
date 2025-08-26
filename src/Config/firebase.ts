import admin, { ServiceAccount } from "firebase-admin";
import service_account from "../../firebase_service_account.json";

admin.initializeApp({
  credential: admin.credential.cert(service_account as ServiceAccount),
});
export const firebaseAdmin = admin;