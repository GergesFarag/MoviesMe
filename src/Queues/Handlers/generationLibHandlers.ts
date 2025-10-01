import { Job } from "bull";
import User from "../../Models/user.model";
import JobModel from "../../Models/job.model";
import { ImageGenerationService } from "../../Services/imageGeneration.service";
import {
  NotificationService,
  NotificationData,
} from "../../Services/notification.service";
import { getIO } from "../../Sockets/socket";
import { updateJobProgress } from "../../Utils/Model/model.utils";
import AppError from "../../Utils/Errors/AppError";
import { getUserLangFromDB } from "../../Utils/Format/languageUtils";
import { translationService } from "../../Services/translation.service";
import { Types } from "mongoose";
import { VideoGenerationService } from "../../Services/videoGeneration.service";

export interface IGenerationLibJobData {
  userId: string;
  prompt: string;
  refImages?: string[];
  isVideo?: boolean;
  size?: string;
  jobId: string;
}

export class GenerationLibQueueHandler {
  private notificationService: NotificationService;
  private imageGenerationService: ImageGenerationService;
  private videoGenerationService: VideoGenerationService;

  constructor() {
    this.notificationService = new NotificationService();
    this.imageGenerationService = new ImageGenerationService();
    this.videoGenerationService = new VideoGenerationService();
  }

  async processGenerationLib(job: Job<IGenerationLibJobData>) {
    const { userId, prompt, refImages, isVideo = false, jobId } = job.data;
    let intervalId: NodeJS.Timeout | null = null;

    try {
      console.log(
        `🎨 Processing GenerationLib job ${jobId} for user ${userId}`
      );

      await JobModel.findOneAndUpdate(
        { jobId: jobId },
        { status: "processing" }
      );

      let progress = 10;
      intervalId = setInterval(async () => {
        if (job && progress < 90) {
          console.log(`📈 GenerationLib Progress: ${progress}%`);
          progress += 5;
          await updateJobProgress(
            job,
            progress,
            "Generating image...",
            getIO(),
            "generationLib:progress"
          );
        }
      }, 2000);

      await updateJobProgress(
        job,
        10,
        "Starting generation...",
        getIO(),
        "generationLib:progress"
      );
      let result = null;
      if (!isVideo) {
        const resultURL =
          await this.imageGenerationService.generateForGenerationLib(
            prompt,
            refImages
          );

        await updateJobProgress(
          job,
          95,
          "Finalizing...",
          getIO(),
          "generationLib:progress"
        );

        const thumbnail = resultURL;

        await updateJobProgress(
          job,
          100,
          "Completed",
          getIO(),
          "generationLib:progress"
        );

        result = {
          userId,
          jobId,
          resultURL,
          thumbnail,
          prompt,
          isVideo,
          duration: isVideo ? 10 : 0,
          refImages,
        };
        console.log(`✅ Successfully processed GenerationLib job ${jobId}`);
      } else {
        const resultURL =
          await this.videoGenerationService.generateVideoForGenerationLib(
            refImages && refImages[0] ? refImages[0] : undefined,
            5,
            prompt
          );
        if (!resultURL) {
          throw new AppError("Video generation failed", 500);
        }
        await updateJobProgress(
          job,
          95,
          "Finalizing...",
          getIO(),
          "generationLib:progress"
        );
        const thumbnail = refImages && refImages[0] ? refImages[0] : resultURL;

        await updateJobProgress(
          job,
          100,
          "Completed",
          getIO(),
          "generationLib:progress"
        );

        result = {
          userId,
          jobId,
          resultURL,
          thumbnail,
          prompt,
          isVideo,
          duration: 5,
          refImages,
        };
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return result;
    } catch (error) {
      console.error(`❌ Error processing GenerationLib job ${jobId}:`, error);

      if (intervalId) {
        clearInterval(intervalId);
      }

      await JobModel.findOneAndUpdate({ jobId: jobId }, { status: "failed" });

      await updateJobProgress(
        job,
        0,
        "Failed",
        getIO(),
        "generationLib:failed"
      );

      throw error;
    }
  }

  async onCompleted(job: Job<IGenerationLibJobData>, result: any) {
    try {
      const locale = await getUserLangFromDB(result.userId);

      await JobModel.findOneAndUpdate(
        { jobId: result.jobId },
        { status: "completed" }
      );

      const user = await User.findById(result.userId);
      if (!user) {
        console.error("User not found for userId:", result.userId);
        return;
      }

      if (!user.generationLib) {
        console.warn(
          `User generationLib is undefined for userId: ${result.userId}, initializing...`
        );
        user.generationLib = [];
      }

      if (!result.resultURL) {
        console.error("Result URL is missing for jobId:", result.jobId);
        throw new AppError("Result URL is missing", 500);
      }

      const existingItemIndex = user.generationLib.findIndex(
        (item) => item.jobId === result.jobId
      );

      if (existingItemIndex >= 0) {
        const existingItem = user.generationLib[existingItemIndex];
        existingItem.URL = result.resultURL;
        existingItem.status = "completed";
        existingItem.thumbnail = result.thumbnail || result.resultURL;
        existingItem.duration = result.duration || 0;
        existingItem.updatedAt = new Date();
      } else {
        const newGenerationItem = {
          _id: new Types.ObjectId(),
          jobId: result.jobId,
          URL: result.resultURL,
          status: "completed",
          thumbnail: result.thumbnail || result.resultURL,
          duration: result.duration || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isVideo: result.isVideo || false,
          isFav: false,
        };

        (user.generationLib as any).push(newGenerationItem);
      }

      try {
        await user.validate();
        await user.save();
        console.log(
          `✅ Successfully saved user ${user.id} with updated generationLib`
        );
      } catch (validationError) {
        console.error(
          `❌ Validation error when saving user ${user.id}:`,
          validationError
        );
        throw validationError;
      }

      const io = getIO();
      const payload = {
        jobId: result.jobId,
        status: "completed",
        progress: 100,
        result: { success: true, data: result },
        resultURL: result.resultURL,
        thumbnail: result.thumbnail,
        timestamp: Date.now(),
      };

      const roomName = `user:${result.userId}`;
      io.to(roomName).emit("generationLib:completed", payload);

      const generationItem = user.generationLib.find(
        (item) => item.jobId === result.jobId
      );

      if (generationItem) {
        const rawNotificationData: NotificationData = {
          title: "Generation Complete",
          message: "Your generation has been completed successfully!",
          data: {
            generationId: generationItem._id.toString(),
            jobId: result.jobId,
            userId: result.userId,
            status: "completed",
            resultURL: result.resultURL,
          },
          redirectTo: "/generationLib",
          category: "activities",
        };

        const translatedNotificationData: NotificationData = {
          title:
            translationService.translateText(
              "notifications.generation.completion",
              "title",
              locale
            ) || "Generation Complete",
          message:
            translationService.translateText(
              "notifications.generation.completion",
              "message",
              locale
            ) || "Your generation has been completed successfully!",
          data: rawNotificationData.data,
          redirectTo: rawNotificationData.redirectTo,
          category: rawNotificationData.category,
        };

        const notificationResult =
          await this.notificationService.sendPushNotificationToUser(
            result.userId,
            translatedNotificationData
          );

        if (notificationResult) {
          await this.notificationService.saveNotificationToUser(
            user,
            rawNotificationData
          );
          console.log(
            `✅ Push notification sent to user ${result.userId} for GenerationLib job ${result.jobId}`
          );
        } else {
          console.warn(
            `⚠️ Failed to send push notification to user ${result.userId}`
          );
        }
      }

      console.log(
        `✅ GenerationLib job ${result.jobId} completed successfully`
      );
    } catch (error) {
      console.error(`❌ Error in GenerationLib onCompleted handler:`, error);
      throw error;
    }
  }

  async onFailed(job: Job<IGenerationLibJobData>, err: Error) {
    try {
      const { userId, jobId } = job.data;
      const locale = await getUserLangFromDB(userId);

      console.error(`❌ GenerationLib job ${jobId} failed:`, err.message);

      // Update job status to failed
      await JobModel.findOneAndUpdate(
        { jobId: jobId },
        { status: "failed", error: err.message }
      );

      // Update user's generationLib item status
      const user = await User.findById(userId);
      if (user && user.generationLib) {
        const itemIndex = user.generationLib.findIndex(
          (item) => item.jobId === jobId
        );
        if (itemIndex >= 0) {
          user.generationLib[itemIndex].status = "failed";
          user.generationLib[itemIndex].updatedAt = new Date();
          await user.save();
        }
      }

      const io = getIO();
      const payload = {
        jobId: jobId,
        status: "failed",
        progress: job.progress() ?? 0,
        result: { success: false, data: null },
        failedReason: err?.message,
        timestamp: Date.now(),
      };

      const roomName = `user:${userId}`;
      io.to(roomName).emit("generationLib:failed", payload);

      // Send failure notification using existing notification service
      if (user) {
        // Raw notification data (not translated) to save in user
        const rawNotificationData: NotificationData = {
          title: "Generation Failed",
          message: "Your generation has failed. Please try again.",
          data: {
            jobId: jobId,
            userId: userId,
            status: "failed",
            error: err.message,
          },
          redirectTo: null,
          category: "activities",
        };

        const translatedNotificationData: NotificationData = {
          title:
            translationService.translateText(
              "notifications.generation.failure",
              "title",
              user.preferredLanguage || locale || "en"
            ) || "Generation Failed",
          message:
            translationService.translateText(
              "notifications.generation.failure",
              "message",
              user.preferredLanguage || locale || "en"
            ) || "Your image generation has failed. Please try again.",
          data: rawNotificationData.data,
          redirectTo: rawNotificationData.redirectTo,
          category: rawNotificationData.category,
        };

        await this.notificationService.saveNotificationToUser(
          user,
          rawNotificationData
        );

        if (user?.FCMToken) {
          const notificationResult =
            await this.notificationService.sendPushNotificationToUser(
              userId,
              translatedNotificationData
            );
          if (notificationResult) {
            console.log(`✅ Failure notification sent to user ${userId}`);
          } else {
            console.warn(
              `⚠️ Failed to send failure notification to user ${userId}`
            );
          }
        }
      }

      await this.jobRemoval(job);

      console.log(`❌ GenerationLib job ${jobId} marked as failed`);
    } catch (error) {
      console.error(`❌ Error in GenerationLib onFailed handler:`, error);
    }
  }

  private async jobRemoval(job: Job) {
    try {
      await job.remove();
      console.log(`🗑️ Removed job ${job.id} from queue`);
    } catch (error) {
      console.error(`❌ Error removing job ${job.id}:`, error);
    }
  }
}
