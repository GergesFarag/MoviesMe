import { Message } from "firebase-admin/lib/messaging/messaging-api";
import { firebaseAdmin } from "../../Config/firebase";

export const sendNotificationToClient = async (
  fcmToken: string,
  title: string,
  body: string
) => {
  if (!fcmToken || fcmToken.trim() === '') {
    console.error("Invalid FCM token provided");
    throw new Error("Invalid FCM token");
  }

  const message: Message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: {
      timestamp: Date.now().toString(),
    }
  };

  try {
    if (!firebaseAdmin.apps.length) {
      throw new Error("Firebase Admin is not properly initialized");
    }

    console.log("Attempting to send notification to:", fcmToken.substring(0, 20) + "...");
    
    // Test Firebase Admin connection before sending
    try {
      await firebaseAdmin.auth().listUsers(1); // Quick test call
    } catch (authError) {
      console.error("Firebase authentication test failed:", authError);
      throw new Error(`Firebase authentication failed: ${authError}`);
    }
    
    const response = await firebaseAdmin.messaging().send(message);
    console.log("Successfully sent message:", response);
    return response;
  } catch (error) {
    console.error("Error sending message:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("invalid_grant")) {
        console.error("Firebase authentication error - please check:");
        console.error("1. Service account key format (especially newlines)");
        console.error("2. Server time synchronization");
        console.error("3. Key validity at Firebase console");
      } else if (error.message.includes("invalid-registration-token")) {
        console.error("Invalid FCM token provided");
      } else if (error.message.includes("invalid_argument")) {
        console.error("Invalid argument provided to Firebase");
      }
    }
    
    throw error;
  }
};
