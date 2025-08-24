import { firebaseAdmin } from "../../Config/firebase";
export const sendNotificationToAllUsers = async (
  title: string,
  body: string
) => {
  const message = {
    topic: "Video Generation",
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
