import Queue from "bull";
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
  },
});

taskQueue.process(async (job) => {
  try {
    const { modelData, userId, data, FCM } = job.data;
    if (!modelData) {
      throw new AppError("Model Data not found", 404);
    }
    let modelType = filterModelType(modelData as IAiModel);
    if (!modelType) {
      throw new AppError("Invalid model type", 400);
    }
    const result = await runModel(modelData.name, modelType, data, FCM, job);
    modelType = modelType === "bytedance" ? "image-effects" : modelType;
    return {
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
      duration: modelData.isVideo ? 0 : 0, //* to be edited
    };
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
        item.duration = result.duration || 0;

        if (!modelType) {
          console.error("Model type is missing for jobId:", result.jobId);
        }

        item.URL = result.resultURL;
        item.status = "completed";
        item.modelType = modelType;
        item.duration = result.duration || 0;

        console.log(
          "******************************************\nItem Added:",
          item,
          "\n******************************************"
        );
      }
      return item;
    });

    user.items = updatedItems;
    await user.save();
    const io = getIO();
    const payload = {
      jobId: job.id,
      status: "completed",
      progress: 100,
      result: { success: true, data: result },
      timestamp: Date.now(),
    };

    if (job.data?.userId) {
      io.to(`user:${job.data.userId}`).emit("job:completed", payload);
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

    const user = await User.findById(jobUpdated?.userId);
    if (user) {
      const item = user.items?.find((item) => item.jobId === job.opts.jobId);
      if (item) {
        item.status = "failed";
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
