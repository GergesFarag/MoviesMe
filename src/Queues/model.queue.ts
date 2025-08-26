import Queue from "bull";
import { runModel } from "../Utils/APIs/wavespeed_calling";
import User from "../Models/user.model";
import AppError from "../Utils/Errors/AppError";
import { filterModelType } from "../Utils/Format/filterModelType";
import Model from "../Models/aiModel.model";
import IAiModel from "../Interfaces/aiModel.interface";
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
    console.log("Job data received:", job.data);

    const { modelData, userId, data, FCM } = job.data;

    if (!modelData) {
      throw new AppError("Model Data not found", 404);
    }
    const modelType = filterModelType(modelData as IAiModel);
    if (!modelType) {
      throw new AppError("Invalid model type", 400);
    }

    const result = await runModel(modelData.name, modelType, data, FCM, job);

    return {
      result,
      userId,
      modelType: modelType === "bytedance" ? "image-effects" : modelType,
      resultURL: data.image,
      modelName: modelData.name,
      isVideo: modelData.isVideo,
      modelThumbnail: modelData.thumbnail,
    };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});

taskQueue.on("completed", async (job, result: any) => {
  try {
    const user = await User.findById(result.userId);
    if (!user) return;

    user.videos?.push({
      URL: result.resultURL,
      modelType: result.modelType,
      modelName: result.modelName,
      isVideo: result.isVideo,
      modelThumbnail: result.modelThumbnail,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await user.save();
  } catch (err) {
    console.error("Failed to save video to user", err);
  }
});

taskQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

export default taskQueue;
