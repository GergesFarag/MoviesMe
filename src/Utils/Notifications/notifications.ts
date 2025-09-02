import { Message } from "firebase-admin/lib/messaging/messaging-api";
import { firebaseAdmin } from "../../Config/firebase";

export const sendNotificationToClient = async (
  fcmToken: string,
  title: string,
  body: string
) => {
  // Validate FCM token
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
    // Verify Firebase Admin is properly initialized
    if (!firebaseAdmin.apps.length) {
      throw new Error("Firebase Admin is not properly initialized");
    }

    console.log("Attempting to send notification to:", fcmToken.substring(0, 20) + "...");
    const response = await firebaseAdmin.messaging().send(message);
    console.log("Successfully sent message:", response);
    return response;
  } catch (error) {
    console.error("Error sending message:", error);
    
    // Provide specific error handling for common Firebase errors
    if (error instanceof Error) {
      if (error.message.includes("invalid_grant")) {
        console.error("Firebase authentication error - please check service account key and server time");
      } else if (error.message.includes("invalid-registration-token")) {
        console.error("Invalid FCM token provided");
      }
    }
    
    throw error;
  }
};
