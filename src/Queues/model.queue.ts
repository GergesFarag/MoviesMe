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
import { IEffectItem } from "../Interfaces/effectItem.interface";
import { NotificationItemDTO } from "../DTOs/item.dto";
import { getItemFromUser } from "../Utils/Database/optimizedOps";
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
    attempts: 1,
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
      userId,
      modelType:
        reverseModelTypeMapper[
          modelType as keyof typeof reverseModelTypeMapper
        ] || modelType,
      resultURL: result,
      modelName: modelData.name,
      isVideo: modelData.isVideo,
      modelThumbnail: modelData.thumbnail,
      jobId: job.id,
      duration: modelData.isVideo ? 0 : 0,
    };
    sendWebsocket(getIO(), "job:completed", dataToBeSent, `user:${userId}`);
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
    await Job.findOneAndUpdate(
      { jobId: result.jobId },
      { status: "completed" }
    );

    await job.remove();

    const user = await User.findById(result.userId);
    if (!user) return;

    const updatedItems = user?.effectsLib?.map((item) => {
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

    user.effectsLib = updatedItems;
    await user.save();
    const item = await getItemFromUser(user.id, result.jobId);
    if (item) {
      const notificationDTO = NotificationItemDTO.toNotificationDTO(item);
      const res = await sendNotificationToClient(
        user?.FCMToken!,
        "Model Processing Completed",
        `Your video generated successfully`,
        {
          ...notificationDTO,
          redirectTo: "/effectDetails",
        }
      );
      if (res) {
        user.notifications?.push({
          title: "Model Processing Completed",
          message: `Your video generated successfully`,
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
    const jobUpdated = await Job.findOneAndUpdate(
      { jobId: job.opts.jobId },
      { status: "failed", error: err.message }
    );

    await job.remove();

    const user = await User.findById(jobUpdated?.userId);
    if (user) {
      const item = user.effectsLib?.find(
        (item) => item.jobId === job.opts.jobId
      );
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
        jobId: String(job.opts.jobId || null),
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
