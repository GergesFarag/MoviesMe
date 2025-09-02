import { Router } from "express";
import adminController from "../Controllers/admin.controller";
import { checkServerTime, validateFirebaseCredentials } from "../Utils/Auth/timeCheck";
import { firebaseAdmin } from "../Config/firebase";

const adminRouter = Router();

adminRouter.route("/users")
    .get(adminController.getAllUsers)
    .post(adminController.addUser);

adminRouter.route("/users/:id")
    .get(adminController.getUserById)
    .delete(adminController.deleteUser)
    .put(adminController.updateUser);

// Debug endpoint for Firebase issues
adminRouter.get("/debug/firebase", async (req, res) => {
    try {
        console.log("=== Firebase Debug Information ===");
        
        // Check environment variables
        validateFirebaseCredentials();
        console.log("✓ Environment variables validated");
        
        // Check server time
        await checkServerTime();
        console.log("✓ Server time checked");
        
        // Test Firebase Admin connection
        const testResult = await firebaseAdmin.auth().listUsers(1);
        console.log("✓ Firebase Admin connection successful");
        
        // Test messaging service
        const messaging = firebaseAdmin.messaging();
        console.log("✓ Firebase Messaging service accessible");
        
        res.json({
            success: true,
            message: "Firebase is properly configured",
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            serverTime: new Date().toISOString(),
            firebaseAppsCount: firebaseAdmin.apps.length
        });
        
    } catch (error) {
        console.error("Firebase debug failed:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
            privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0
        });
    }
});

export default adminRouter;