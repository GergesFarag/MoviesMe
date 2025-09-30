import { NotificationItemDTO } from "../../DTOs/item.dto";
import Job from "../../Models/job.model";
import User from "../../Models/user.model";
import {
  NotificationData,
  NotificationService,
} from "../../Services/notification.service";
import { translationService } from "../../Services/translation.service";
import { getIO } from "../../Sockets/socket";
import { getItemFromUser } from "../../Utils/Database/optimizedOps";
import AppError from "../../Utils/Errors/AppError";
import { modelTypeMapper } from "../../Utils/Format/filterModelType";
import { getUserLangFromDB } from "../../Utils/Format/languageUtils";

export class EffectsQueueHandler {
  private notificationService;
  constructor() {
    this.notificationService = new NotificationService();
  }

  async onCompleted(job: any, result: any) {
    try {
      const locale = await getUserLangFromDB(result.userId);

      await Job.findOneAndUpdate(
        { jobId: result.jobId },
        { status: "completed" }
      );
      await this.jobRemoval(job);
      const user = await User.findById(result.userId);
      if (!user) {
        console.error("User not found for userId:", result.userId);
        return;
      }

      if (!user.effectsLib || user.effectsLib.length === 0) {
        console.warn(
          `User effectsLib is empty for userId: ${result.userId}, initializing...`
        );
        if (!user.effectsLib) {
          user.effectsLib = [];
        }

        const modelType =
          modelTypeMapper[result.modelType as keyof typeof modelTypeMapper] ||
          result.modelType ||
          "unknown";

        if (!result.resultURL) {
          console.error("Result URL is missing for jobId:", result.jobId);
          throw new AppError("Result URL is missing", 500);
        }

        const newEffect = {
          jobId: result.jobId,
          URL: result.resultURL,
          status: "completed",
          effectThumbnail: result.effectThumbnail || result.resultURL,
          modelType: modelType,
          modelName: result.modelName,
          duration: result.duration || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isVideo: result.isVideo || false,
          modelThumbnail: result.modelThumbnail,
          isFav: false,
        };

        // Use direct push - Mongoose will handle _id generation
        (user.effectsLib as any).push(newEffect);
      } else {
        // Update existing effectsLib
        const updatedItems = user.effectsLib.map((item) => {
          if (item.jobId === result.jobId) {
            const modelType =
              modelTypeMapper[
                result.modelType as keyof typeof modelTypeMapper
              ] ||
              result.modelType ||
              "unknown";

            if (!result.resultURL) {
              console.error("Result URL is missing for jobId:", result.jobId);
              throw new AppError("Result URL is missing", 500);
            }

            item.URL = result.resultURL;
            item.status = "completed";
            item.effectThumbnail = result.effectThumbnail || result.resultURL;
            item.modelType = modelType || "unknown";
            item.duration = result.duration || 0;
            item.updatedAt = new Date();
          }
          return item;
        });

        // Check if any item was actually updated
        const updatedItem = updatedItems.find(
          (item) => item.jobId === result.jobId
        );
        if (!updatedItem) {
          console.error("No item found with jobId:", result.jobId);

          const modelType =
            modelTypeMapper[result.modelType as keyof typeof modelTypeMapper] ||
            result.modelType ||
            "unknown";

          const newEffect = {
            jobId: result.jobId,
            URL: result.resultURL,
            status: "completed",
            effectThumbnail: result.effectThumbnail || result.resultURL,
            modelType: modelType,
            modelName: result.modelName,
            duration: result.duration || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isVideo: result.isVideo || false,
            modelThumbnail: result.modelThumbnail,
            isFav: false,
          };

          (updatedItems as any).push(newEffect);
        }

        user.effectsLib = updatedItems;
      }

      try {
        await user.validate();
        await user.save();
        console.log(
          `✅ Successfully saved user ${user.id} with updated effectsLib`
        );
      } catch (validationError) {
        console.error(
          `❌ Validation error when saving user ${user.id}:`,
          validationError
        );
        throw validationError;
      }

      const item = await getItemFromUser(user.id, result.jobId);
      if (item) {
        const notificationDTO = NotificationItemDTO.toNotificationDTO(item);
        console.log("Locale", locale);
        const notificationData: NotificationData = {
          title: translationService.translateText(
            "notifications.effect.completion",
            "title",
            locale
          ),
          message: translationService.translateText(
            "notifications.effect.completion",
            "message",
            locale
          ),
          data: notificationDTO,
          redirectTo: "/effectDetails",
          category: "activities",
        };
        const res = await this.notificationService.sendPushNotificationToUser(
          job.data.userId,
          notificationData
        );

        if (res) {
          await this.notificationService.saveNotificationToUser(
            user,
            notificationData
          );
          console.log(
            `✅ Push notification sent to user ${job.data.userId} for job ${job.id}`
          );
        }
      }
    } catch (err) {
      console.error("Failed to handle job completion:", err);
      throw err;
    }
  }

  async onFailed(job: any, err: Error) {
    try {
      console.error(`Job ${job.id} failed with error: ${err.message}`);

      const jobId = job.opts.jobId || job.id;
      const jobUpdated = await Job.findOneAndUpdate(
        { jobId: jobId },
        { status: "failed", error: err.message }
      );
      await this.jobRemoval(job);
      const user = await User.findById(jobUpdated?.userId);
      if (user) {
        const item = user.effectsLib?.find((item) => item.jobId === jobId);
        if (item) {
          item.status = "failed";
          item.updatedAt = new Date();
          await user.save();
        }
        const io = getIO();
        const payload = {
          jobId: job.id,
          status: "failed",
          progress: job.progress() ?? 0,
          result: { success: false, data: null },
          failedReason: err?.message,
          timestamp: Date.now(),
        };

        if (job.data?.userId) {
          io.to(`user:${job.data.userId}`).emit("job:failed", payload);
        }
        const notificationDTO = {
          storyId: null,
          jobId: String(jobId),
          userId: String(job.data.userId || null),
          status: "failed",
        };

        const notificationData: NotificationData = {
          title: translationService.translateText(
            "notifications.effect.failure",
            "title",
            user.preferredLanguage || "en"
          ),
          message: translationService.translateText(
            "notifications.effect.failure",
            "message",
            user.preferredLanguage || "en"
          ),
          data: notificationDTO,
          redirectTo: null,
          category: "activities",
        };
        this.notificationService.saveNotificationToUser(user, notificationData);
        if (user?.FCMToken) {
          const notificationResult =
            await this.notificationService.sendPushNotificationToUser(
              job.data.userId,
              notificationData
            );
          if (notificationResult) {
            console.log(`✅ Push notification sent to user ${job.data.userId}`);
          } else {
            console.warn(
              `⚠️ Failed to send push notification to user ${job.data.userId}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to handle job failure:", error);
    }
  }

  private async jobRemoval(job: any) {
    try {
      const jobExists =
        (await job.isActive()) ||
        (await job.isWaiting()) ||
        (await job.isDelayed()) ||
        (await job.isCompleted()) ||
        (await job.isFailed());

      if (jobExists) {
        await job.remove();
        console.log(`✅ Successfully removed job ${job.id} from queue`);
      } else {
        console.warn(
          `⚠️ Job ${job.id} no longer exists in queue, skipping removal`
        );
      }
    } catch (removeError: any) {
      if (removeError?.message?.includes("Could not remove job")) {
        console.warn(
          `⚠️ Job ${job.id} might already be removed or processed by another worker`
        );
      } else {
        console.warn(`⚠️ Failed to remove job ${job.id}:`, removeError);
      }
    }
  }
}
