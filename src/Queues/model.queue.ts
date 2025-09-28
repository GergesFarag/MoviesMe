import { runModel } from "../Utils/APIs/runModel";
import User from "../Models/user.model";
import AppError from "../Utils/Errors/AppError";
import {
  filterModelType,
  modelTypeMapper,
  reverseModelTypeMapper,
} from "../Utils/Format/filterModelType";
import IAiModel from "../Interfaces/aiModel.interface";
import Job from "../Models/job.model";
import { getIO } from "../Sockets/socket";
import { updateJobProgress } from "../Utils/Model/model.utils";
import { sendNotificationToClient } from "../Utils/Notifications/notifications";
import { NotificationItemDTO } from "../DTOs/item.dto";
import { getItemFromUser } from "../Utils/Database/optimizedOps";
import Queue from "bull";
import { getRedisConfig } from "../Config/redis";
import {
  JOB_OPTIONS,
  QUEUE_NAMES,
  QUEUE_SETTINGS,
} from "./Constants/queueConstants";
import {
  NotificationData,
  NotificationService,
} from "../Services/notification.service";
import { translationService } from "../Services/translation.service";
import { getUserLangFromDB } from "../Utils/Format/languageUtils";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";

const redisConfig = getRedisConfig();
export const taskQueue = new Queue(QUEUE_NAMES.MODEL_PROCESSING, {
  redis: redisConfig,
  defaultJobOptions: JOB_OPTIONS,
  settings: QUEUE_SETTINGS,
});
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

async function handleJobCompletion(job: any, result: any): Promise<void> {
  try {
    const notificationService = new NotificationService();
    const locale = await getUserLangFromDB(result.userId);
    
    // Update job status in database
    await Job.findOneAndUpdate(
      { jobId: result.jobId },
      { status: "completed" }
    );

    // Safe job removal with error handling
    try {
      // Check if job still exists in the queue before attempting removal
      const jobExists = await job.isActive() || await job.isWaiting() || 
                       await job.isDelayed() || await job.isCompleted() || 
                       await job.isFailed();
      
      if (jobExists) {
        await job.remove();
        console.log(`✅ Successfully removed job ${job.id} from queue`);
      } else {
        console.warn(`⚠️ Job ${job.id} no longer exists in queue, skipping removal`);
      }
    } catch (removeError: any) {
      // More specific error handling for job removal
      if (removeError?.message?.includes('Could not remove job')) {
        console.warn(`⚠️ Job ${job.id} might already be removed or processed by another worker`);
      } else {
        console.warn(`⚠️ Failed to remove job ${job.id}:`, removeError);
      }
      // Don't throw here, continue with the rest of the process
    }

    const user = await User.findById(result.userId);
    if (!user) {
      console.error("User not found for userId:", result.userId);
      return;
    }

    // Initialize effectsLib if it doesn't exist or is empty
    if (!user.effectsLib || user.effectsLib.length === 0) {
      console.warn(`User effectsLib is empty for userId: ${result.userId}, initializing...`);
      if (!user.effectsLib) {
        user.effectsLib = [];
      }
      
      // Since we're completing a job, we should add the result even if effectsLib was empty
      const modelType = modelTypeMapper[result.modelType as keyof typeof modelTypeMapper] || 
                       result.modelType || "unknown";
      
      if (!result.resultURL) {
        console.error("Result URL is missing for jobId:", result.jobId);
        throw new AppError("Result URL is missing", 500);
      }
      
      // Create a new effect item for the completed job
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
        isFav: false
      };
      
      // Use direct push - Mongoose will handle _id generation
      (user.effectsLib as any).push(newEffect);
    } else {
      // Update existing effectsLib
      const updatedItems = user.effectsLib.map((item) => {
        if (item.jobId === result.jobId) {
          const modelType =
            modelTypeMapper[result.modelType as keyof typeof modelTypeMapper] ||
            result.modelType || "unknown";

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
        // Add the item if it wasn't found
        const modelType = modelTypeMapper[result.modelType as keyof typeof modelTypeMapper] || 
                         result.modelType || "unknown";
        
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
          isFav: false
        };
        
        // Use type assertion - Mongoose will handle _id generation
        (updatedItems as any).push(newEffect);
      }

      user.effectsLib = updatedItems;
    }

    // Validate the user before saving
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
      const res = await notificationService.sendPushNotificationToUser(
        user._id as unknown as string,
        notificationData
      );

      if (res) {
        user.notifications?.push({
          title: notificationData.title,
          message: notificationData.message,
          data: notificationDTO,
          redirectTo: "/effectDetails",
          category: "activities",
          createdAt: new Date(),
        });
        await user.save();
      }
    }
  } catch (err) {
    console.error("Failed to handle job completion:", err);
    throw err;
  }
}
taskQueue.process(async (job) => {
  try {
    const { modelData, userId, data, FCM, prompt, skipModelTypeFilteration } =
      job.data;
    if (!modelData) {
      throw new AppError("Model Data not found", 404);
    }
    if (skipModelTypeFilteration) {
      if (!WAVESPEED_API_KEY) {
        console.error(
          "Your API_KEY is not set, you can check it in Access Keys"
        );
        throw new AppError("WAVESPEED_API_KEY is not set", 500);
      }
      console.log("Model Data: ", modelData.wavespeedCall);
      const url = `https://api.wavespeed.ai/api/v3/${modelData.wavespeedCall}`;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WAVESPEED_API_KEY}`,
      };
      const payload = {
        enable_base64_output: false,
        enable_sync_mode: false,
        images: data.images,
        prompt: prompt,
        size: "2227*3183",
      };
      const response = await wavespeedBase(url, headers, payload);
      if (!response) {
        throw new AppError("Model processing failed", 500);
      }
      const dataToBeSent = {
        userId,
        modelType: "image-effects", 
        resultURL: response,
        modelName: modelData.name,
        isVideo: modelData.isVideo,
        modelThumbnail: modelData.thumbnail,
        effectThumbnail : response,
        jobId: job.id,
        duration: modelData.isVideo ? 0 : 0,
      };
      updateJobProgress(
        job,
        100,
        "Processing completed",
        getIO(),
        "job:progress"
      );

      await handleJobCompletion(job, dataToBeSent);

      return dataToBeSent;
    } else {
      let modelType = filterModelType(modelData as IAiModel);
      if (!modelType) {
        throw new AppError("Invalid model type", 400);
      }
      const result = await runModel(
        modelData.name,
        modelType,
        data,
        FCM,
        job,
        getIO()
      );
      if (!result) {
        throw new AppError("Model processing Result Failed", 500);
      }
      modelType = modelType === "bytedance" ? "image-effects" : modelType;

      const effectThumbnail = modelData.isVideo ? modelData.thumbnail : result;

      const dataToBeSent = {
        userId,
        modelType:
          reverseModelTypeMapper[
            modelType as keyof typeof reverseModelTypeMapper
          ] || modelType,
        resultURL: result,
        modelName: modelData.name,
        isVideo: modelData.isVideo,
        modelThumbnail: modelData.thumbnail,
        effectThumbnail,
        jobId: job.id,
        duration: modelData.isVideo ? 0 : 0,
      };
      updateJobProgress(
        job,
        100,
        "Processing completed",
        getIO(),
        "job:progress"
      );

      // let notificationData = {
      //   URL: data.image,
      //   modelType: modelData.name,
      //   modelName: modelData.name,
      //   isVideo: modelData.isVideo,
      //   isFav: false,
      //   status: "completed",
      //   modelThumbnail: modelData.thumbnail,
      //   jobId: job.id as string,
      //   duration: modelData.isVideo ? 0 : 0,
      // };
      return dataToBeSent;
    }
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});

taskQueue.on("completed", async (job, result: any) => {
  try {
    await handleJobCompletion(job, result);
  } catch (err) {
    console.error("Failed to save item to user", err);
  }
});

taskQueue.on("failed", async (job, err) => {
  try {
    console.error(`Job ${job.id} failed with error: ${err.message}`);

    // Use consistent job ID handling
    const jobId = job.opts.jobId || job.id;
    const jobUpdated = await Job.findOneAndUpdate(
      { jobId: jobId },
      { status: "failed", error: err.message }
    );

    // Safe job removal with error handling
    try {
      const jobExists =
        (await job.isActive()) ||
        (await job.isWaiting()) ||
        (await job.isDelayed()) ||
        (await job.isFailed());
      if (jobExists) {
        await job.remove();
      } else {
        console.warn(
          `⚠️ Job ${job.id} no longer exists in queue, skipping removal`
        );
      }
    } catch (removeError) {
      console.warn(`⚠️ Failed to remove failed job ${job.id}:`, removeError);
    }

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
      user.notifications?.push({
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
        createdAt: new Date(),
        category: "activities",
      });
      await user?.save();
      if (user?.FCMToken) {
        await sendNotificationToClient(
          user.FCMToken,
          translationService.translateText(
            "notifications.effect.failure",
            "title",
            user.preferredLanguage || "en"
          ),
          translationService.translateText(
            "notifications.effect.failure",
            "message",
            user.preferredLanguage || "en"
          ),
          {
            ...notificationDTO,
            redirectTo: null,
            category: "activities",
          }
        );
      }
    }
  } catch (error) {
    console.error("Failed to handle job failure:", error);
  }
});

export default taskQueue;
