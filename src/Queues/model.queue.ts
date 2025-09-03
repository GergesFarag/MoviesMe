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
import Queue from "bull";
import { updateJobProgress } from "../Utils/Model/model.utils";
import { sendWebsocket } from "../Sockets/socket";
import { sendNotificationToClient } from "../Utils/Notifications/notifications";
import { IItem } from "../Interfaces/item.interface";
const redisPort = (process.env.REDIS_PORT as string)
  ? parseInt(process.env.REDIS_PORT as string, 10)
  : 6379;

export const taskQueue = new Queue("modelProcessing", {
  redis: {
    host: process.env.REDIS_HOST as string,
    port: redisPort,
    password: (process.env.REDIS_PASSWORD as string) || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    timeout: 300000,
    removeOnComplete: 10, // Keep only 10 completed jobs
    removeOnFail: 5, // Keep only 5 failed jobs
  },
});

taskQueue.process(async (job) => {
  try {
    const { modelData, userId, data, FCM } = job.data;
    updateJobProgress(job, 10, "Start Processing...", getIO(), "job:progress");
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
    modelType = modelType === "bytedance" ? "image-effects" : modelType;
    const dataToBeSent = {
      result,
      userId,
      modelType:
        reverseModelTypeMapper[
          modelType as keyof typeof reverseModelTypeMapper
        ] || modelType,
      resultURL: data.image,
      modelName: modelData.name,
      isVideo: modelData.isVideo,
      modelThumbnail: modelData.thumbnail,
      jobId: job.id,
      duration: modelData.isVideo ? 0 : 0,
    };
    sendWebsocket(getIO(), "job:completed", dataToBeSent, `user:${userId}`);
    let notificationData = {
      URL: String(data.image),
      modelType: String(modelData.name),
      modelName: String(modelData.name),
      isVideo: String(modelData.isVideo),
      isFav: String(false),
      modelThumbnail: String(modelData.thumbnail),
      jobId: String(job.id),
      duration: String(modelData.isVideo ? 0 : 0),
    };
    Object.keys(notificationData).forEach((key) => String(notificationData[key as keyof typeof notificationData]));
    console.log("first", notificationData);
    await sendNotificationToClient(
      "d9OD-zNgTcCcGdur0OiHhb:APA91bEPHYE2KcPjqSK3s9-5sUGTd5tff1N65hxm8VHA-jtvmXDcLvMbG3qYEYBSms0N987QvKQsmVYGgnnu-fqajJn71ihzPD_kWqI9auyWTq9eFa8WYxc", //! fix it later on
      "Model Processing Completed",
      `Your video generated successfully`,
      notificationData
    );
    return dataToBeSent;
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});

taskQueue.on("completed", async (job, result: any) => {
  try {
    await Job.findOneAndUpdate(
      { jobId: result.jobId },
      { status: "completed" }
    );

    await job.remove();

    const user = await User.findById(result.userId);
    if (!user) return;

    const updatedItems = user?.items?.map((item) => {
      if (item.jobId === result.jobId) {
        const modelType =
          modelTypeMapper[result.modelType as keyof typeof modelTypeMapper] ||
          result.modelType;

        if (!modelType) {
          console.error("Model type is missing for jobId:", result.jobId);
        }

        item.URL = result.resultURL;
        item.status = "completed";
        item.modelType = modelType;
        item.duration = result.duration || 0;
        item.updatedAt = new Date();
        console.log(
          "******************************************\nItem Updated:",
          item,
          "\n******************************************"
        );
      }
      return item;
    });

    user.items = updatedItems;
    await user.save();
  } catch (err) {
    console.error("Failed to save item to user", err);
  }
});

taskQueue.on("failed", async (job, err) => {
  try {
    console.error(`Job ${job.id} failed with error: ${err.message}`);
    const jobUpdated = await Job.findOneAndUpdate(
      { jobId: job.opts.jobId },
      { status: "failed", error: err.message }
    );

    // Clean up the failed job from Redis to free memory
    await job.remove();

    const user = await User.findById(jobUpdated?.userId);
    if (user) {
      const item = user.items?.find((item) => item.jobId === job.opts.jobId);
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
    }
  } catch (error) {
    console.error("Failed to handle job failure:", error);
  }
});

export default taskQueue;
