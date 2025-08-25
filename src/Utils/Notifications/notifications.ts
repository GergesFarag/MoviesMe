import { firebaseAdmin } from "../../Config/firebase";

export const sendNotificationToClient = async (
  fcmToken: string,
  title: string,
  body: string
) => {
  const message = {
    token: fcmToken, 
    notification: {
      title: title,
      body: body,
    },
  };

  try {
    const response = await firebaseAdmin.messaging().send(message);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.error("Error sending message:", error);
  }
};
