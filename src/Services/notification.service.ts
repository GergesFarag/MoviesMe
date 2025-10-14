import User from "../Models/user.model";
import { sendNotificationToClient } from "../Utils/Notifications/notifications";
import { getIO } from "../Sockets/socket";
import { StoryDTO } from "../DTOs/story.dto";
import { TNotificationCategory } from "../types";
import { translationService } from "./translation.service";
import { getUserLangFromDB } from "../Utils/Format/languageUtils";
import AppError from "../Utils/Errors/AppError";
import { INotificationItemDTO } from "../DTOs/item.dto";
import { INotification } from "../Interfaces/notification.interface";
import { CreditService } from "./credits.service";

export interface NotificationData {
  title: string;
  message: string;
  data: Record<string, any>;
  redirectTo?: string | null;
  category?: TNotificationCategory;
}

interface SocketNotificationPayload {
  message: string;
  jobId?: string;
  error?: string;
  timestamp?: string;
  [key: string]: any;
}
type keyType = 'refundedCredits' | 'consumedCredits';
export class NotificationService {
  private creditService: CreditService;
  constructor() {
    this.creditService = new CreditService();
  }

  async sendStoryCompletionNotification(
    userId: string,
    storyData: any,
    finalVideoUrl: string,
    jobId: string
  ): Promise<void> {
    const locale = await getUserLangFromDB(userId);
    // Validate story data
    if (!storyData) {
      console.error("❌ No story found in result object");
      await this.sendSocketNotification(userId, "story:failed", {
        message: "Story generation completed but no story data found",
        jobId,
        error: "Missing story data in result",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Ensure scenes array exists and is valid
    if (!storyData.scenes || !Array.isArray(storyData.scenes)) {
      console.error("❌ Story scenes are missing or invalid:", storyData);
      await this.sendSocketNotification(userId, "story:failed", {
        message: "Story scenes data is invalid",
        jobId,
        error: "Invalid scenes data",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const storyDTO = StoryDTO.toDTO(storyData);

      const notificationDTO = {
        storyId: String(storyData._id || null),
        jobId: String(jobId),
        status: String(storyData.status || "completed"),
        userId: String(userId),
        credits: storyData.credits,
      };

      const notificationData: NotificationData = {
        title: translationService.translateText(
          "notifications.story.completion",
          "title",
          locale
        ),
        message: translationService.translateText(
          "notifications.story.completion",
          "message",
          locale
        ),
        data: notificationDTO,
        redirectTo: "/storyDetails",
        category: "activities",
      };

      await this.sendSocketNotification(userId, "story:completed", {
        message: notificationData.message,
        story: storyDTO,
        jobId,
        finalVideoUrl,
        storyId: storyData._id,
        timestamp: new Date().toISOString(),
      });

      await this.sendPushNotificationToUser(userId, notificationData);
    } catch (dtoError) {
      console.error("❌ Error converting story to DTO:", dtoError);
      await this.sendSocketNotification(userId, "story:failed", {
        message: translationService.translateText(
          "notifications.story.failure",
          "message",
          locale
        ),
        jobId,
        error:
          dtoError instanceof Error
            ? dtoError.message
            : "DTO conversion failed",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send story failure notification (both push and socket)
   */
  async sendStoryFailureNotification(
    userId: string,
    jobId: string,
    error: Error | AppError,
    consumedCredits: number,
    storyId?: string
  ): Promise<void> {
    const locale = await getUserLangFromDB(userId);
    const notificationDTO = {
      storyId: String(storyId || null),
      jobId: String(jobId),
      status: "failed",
      userId: String(userId),
      error: error.message,
    };

    const notificationData: NotificationData = {
      title: translationService.translateText(
        "notifications.story.failure",
        "title",
        locale
      ),
      message: translationService.translateText(
        "notifications.story.failure",
        "message",
        locale
      ),
      data: notificationDTO,
      redirectTo: null,
      category: "activities",
    };

    // Send socket notification
    await this.sendSocketNotification(userId, "story:failed", {
      message: notificationData.message,
      jobId,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    // Send push notification and save to database
    await this.sendPushNotificationToUser(userId, notificationData);
  }

  /**
   * Send story stalled notification (socket only)
   */
  async sendStoryProgressNotification(
    userId: string,
    jobId: string,
    progress: number,
    message: string
  ): Promise<void> {
    await this.sendSocketNotification(userId, "story:progress", {
      jobId,
      progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send push notification to a specific user
   */
  async sendPushNotificationToUser(
    userId: string,
    notificationData: NotificationData
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.error(`❌ User not found for notification: ${userId}`);
        return false;
      }

      let pushNotificationSent = false;

      // Send push notification if FCM token exists
      if (user.FCMToken) {
        try {
          const pushResult = await sendNotificationToClient(
            user.FCMToken,
            notificationData.title,
            notificationData.message,
            {
              ...notificationData.data,
              redirectTo: notificationData.redirectTo,
              category: notificationData.category,
            }
          );

          if (pushResult) {
            console.log(`✅ Push notification sent to user ${userId}`);
            pushNotificationSent = true;
          }
        } catch (pushError) {
          console.error(
            `❌ Failed to send push notification to user ${userId}:`,
            pushError
          );
        }
      } else {
        console.log(
          `⚠️ No FCM token found for user ${userId}, skipping push notification`
        );
      }
      return pushNotificationSent;
    } catch (error) {
      console.error(
        `❌ Failed to send push notification to user ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Save notification to user's notifications array
   */
  async saveNotificationToUser(
    user: any,
    notificationData: NotificationData
  ): Promise<void> {
    try {
      user.notifications = user.notifications || [];
      user.notifications.push({
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        redirectTo: notificationData.redirectTo,
        createdAt: new Date(),
        category: notificationData.category || "system",
        isRead: false,
      });

      await user.save();
      console.log(`✅ Notification saved to user ${user._id} database`);
    } catch (error) {
      console.error(`❌ Failed to save notification to user database:`, error);
    }
  }

  static getNotificationStatusAndType(
    notification: INotification
  ): INotificationItemDTO {
    const status = NotificationService.getNotificationStatus(notification);
    const type = NotificationService.getNotificationType(notification);
    console.log("Notification status and type:", { status, type });
    return { status, type };
  }
  async sendTransactionalSocketNotification(
    userId: string,
    notificationData: {userCredits: number} & {[key in keyType]?: number}){
    const user = await User.findById(userId).lean();
    if (!user) {
      console.error(`❌ User not found for notification: ${userId}`);
      return;
    }
    await this.sendSocketNotification(userId, "user:transactions", {
      message: `Transaction for effect has been completed.`,
      data: notificationData
    });
  }
  private async sendSocketNotification(
    userId: string,
    event: string,
    payload: SocketNotificationPayload
  ): Promise<void> {
    try {
      const io = getIO();
      const roomName = `user:${userId}`;

      io.to(roomName).emit(event, payload);
      console.log(
        `✅ Socket notification '${event}' sent to room: ${roomName}`
      );
    } catch (error) {
      console.error(
        `❌ Failed to send socket notification to user ${userId}:`,
        error
      );
    }
  }
  private static getNotificationStatus(notification: INotification): string {
    type validStatuses = "completed" | "pending" | "failed";
    const statusMapper: Record<validStatuses, string> = {
      completed: "completion",
      pending: "pending",
      failed: "failure",
    };
    return statusMapper[notification.data.status as validStatuses];
  }
  private static getNotificationType(notification: INotification): string {
    const notificationStatus =
      NotificationService.getNotificationStatus(notification);
    if (
      notificationStatus === "completed" ||
      notificationStatus === "pending"
    ) {
      if (notification.redirectTo === "/storyDetails") {
        return "story";
      } else if (notification.redirectTo === "/effectDetails") {
        return "effect";
      } else if (notification.redirectTo === "/promotions") {
        return "promotion";
      } else if (notification.redirectTo === "/generationLib") {
        return "generation";
      } else if (notification.redirectTo === "/transactions") {
        return "transaction";
      } else {
        return "system";
      }
    } else {
      if (notification.title.toLowerCase().includes("story")) {
        return "story";
      } else if (notification.title.toLowerCase().includes("effect")) {
        return "effect";
      } else if (notification.title.toLowerCase().includes("promotion")) {
        return "promotion";
      } else if (notification.title.toLowerCase().includes("generation") || notification.title.toLowerCase().includes("generated")) {
        return "generation";
      } else if (notification.title.toLowerCase().includes("transaction")) {
        return "transaction";
      } else {
        return "system";
      }
    }
  }
}
