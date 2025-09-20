import { runModel } from "../Utils/APIs/wavespeed_calling";
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
const redisPort = (process.env.REDIS_PORT as string)
  ? parseInt(process.env.REDIS_PORT as string, 10)
  : 6379;

export const taskQueue = new Queue("modelProcessing", {
  redis: {
    host: process.env.REDIS_HOST as string,
    port: redisPort,
    password: (process.env.REDIS_PASSWORD as string) || undefined,
    connectTimeout: 10000,
  },
  defaultJobOptions: {
    attempts: 1,
    timeout: 300000,
    removeOnComplete: 10, // Keep only 10 completed jobs
    removeOnFail: 5, // Keep only 5 failed jobs
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
  settings: {
    stalledInterval: 30000,
    retryProcessDelay: 5000,
  },
});

taskQueue.process(async (job) => {
  try {
    const { modelData, userId, data, FCM } = job.data;
    updateJobProgress(job, 10, "Start Processing...", getIO(), "job:progress");
    await new Promise((res) => setTimeout(res, 2000));
    if (!modelData) {
      throw new AppError("Model Data not found", 404);
    }
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
  if(!result){
      throw new AppError("Model processing Result Failed", 500);
  }
    modelType = modelType === "bytedance" ? "image-effects" : modelType;
    
    // Generate thumbnail for video results
    const effectThumbnail = modelData.isVideo 
      ? modelData.thumbnail
      : result;
    
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
    updateJobProgress(job, 100, "Processing completed", getIO(), "job:progress");

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
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});

taskQueue.on("completed", async (job, result: any) => {
  try {
    // Update job status in database
    await Job.findOneAndUpdate(
      { jobId: result.jobId },
      { status: "completed" }
    );

    // Safe job removal with error handling
    try {
      const jobExists = await job.isActive() || await job.isWaiting() || await job.isDelayed() || await job.isCompleted();
      if (jobExists) {
        await job.remove();
      } else {
        console.warn(`⚠️ Job ${job.id} no longer exists in queue, skipping removal`);
      }
    } catch (removeError) {
      console.warn(`⚠️ Failed to remove job ${job.id}:`, removeError);
    }

    const user = await User.findById(result.userId);
    if (!user) {
      console.error("User not found for userId:", result.userId);
      return;
    }

    if (!user.effectsLib || user.effectsLib.length === 0) {
      console.error("User effectsLib is empty for userId:", result.userId);
      return;
    }

    const updatedItems = user?.effectsLib?.map((item) => {
      if (item.jobId === result.jobId) {
        const modelType =
          modelTypeMapper[result.modelType as keyof typeof modelTypeMapper] ||
          result.modelType;

        if (!modelType) {
          console.error("Model type is missing for jobId:", result.jobId);
        }

        if (!result.resultURL) {
          console.error("Result URL is missing for jobId:", result.jobId);
          throw new AppError("Result URL is missing", 500);
        }

        item.URL = result.resultURL;
        item.status = "completed";
        item.effectThumbnail = result.effectThumbnail || result.resultURL;
        item.modelType = modelType;
        item.duration = result.duration || 0;
        item.updatedAt = new Date();
      }
      return item;
    });

    // Check if any item was actually updated
    const updatedItem = updatedItems?.find(item => item.jobId === result.jobId);
    if (!updatedItem) {
      console.error("No item found with jobId:", result.jobId);
      return;
    }

    user.effectsLib = updatedItems;
    
    // Validate the user before saving
    try {
      await user.validate();
      await user.save();
      console.log(`✅ Successfully saved user ${user.id} with updated effectsLib`);
    } catch (validationError) {
      console.error(`❌ Validation error when saving user ${user.id}:`, validationError);
      throw validationError;
    }
    const item = await getItemFromUser(user.id, result.jobId);
    if (item) {
      const notificationDTO = NotificationItemDTO.toNotificationDTO(item);
      const res = await sendNotificationToClient(
        user?.FCMToken!,
        "Model Processing Completed",
        `Your effect generated successfully`,
        {
          ...notificationDTO,
          redirectTo: "/effectDetails",
        }
      );
      if (res) {
        user.notifications?.push({
          title: "Model Processing Completed",
          message: `Your effect generated successfully`,
          data: notificationDTO,
          redirectTo: "/effectDetails",
          createdAt: new Date(),
        });
        await user.save();
      }
    }
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
      const jobExists = await job.isActive() || await job.isWaiting() || await job.isDelayed() || await job.isFailed();
      if (jobExists) {
        await job.remove();
      } else {
        console.warn(`⚠️ Job ${job.id} no longer exists in queue, skipping removal`);
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
        title: "Effect Processing Failed",
        message: `Your effect failed to apply.`,
        data: notificationDTO,
        redirectTo: null,
        createdAt: new Date(),
      });
      await user?.save();
      if (user?.FCMToken) {
        await sendNotificationToClient(
          user.FCMToken,
          "Effect Processing Failed",
          `Your effect failed to apply.`,
          {
            ...notificationDTO,
            redirectTo: null,
          }
        );
      }
    }
  } catch (error) {
    console.error("Failed to handle job failure:", error);
  }
});

export default taskQueue;
