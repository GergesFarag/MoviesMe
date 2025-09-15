import { Message } from "firebase-admin/lib/messaging/messaging-api";
import { firebaseAdmin } from "../../Config/firebase";
export const sendNotificationToClient = async (
  fcmToken: string,
  title: string,
  body: string,
  itemData: Record<string, any>
) => {
  if (!fcmToken || fcmToken.trim() === "") {
    console.error("Invalid FCM token provided");
    throw new Error("Invalid FCM token");
  }

  // Convert all data values to strings as required by Firebase
  const stringifiedData: Record<string, string> = {};
  if (itemData) {
    Object.keys(itemData).forEach(key => {
      const value = itemData[key];
      if (value !== null && value !== undefined) {
        stringifiedData[key] = String(value);
      }
    });
  }

  // Validate that all data values are now strings
  const invalidValues = Object.entries(stringifiedData).filter(([key, value]) => typeof value !== 'string');
  if (invalidValues.length > 0) {
    console.error("Non-string values found in notification data:", invalidValues);
    throw new Error(`Firebase data must only contain string values. Found non-strings: ${invalidValues.map(([k]) => k).join(', ')}`);
  }

  const message: Message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: stringifiedData
  };

  try {
    if (!firebaseAdmin.apps.length) {
      throw new Error("Firebase Admin is not properly initialized");
    }

    console.log(
      "Attempting to send notification to:",
      fcmToken.substring(0, 20) + "..."
    );
    console.log("Notification data:", {
      title,
      body,
      dataKeys: Object.keys(stringifiedData),
      dataValues: stringifiedData
    });
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
      } else if (error.message.includes("data must only contain string values")) {
        console.error("Firebase data validation failed:");
        console.error("Original data:", itemData);
        console.error("Converted data:", stringifiedData);
        console.error("Data types:", Object.entries(stringifiedData).map(([k, v]) => `${k}: ${typeof v}`));
      }
    }
    throw error;
  }
};
