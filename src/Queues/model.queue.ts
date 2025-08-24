import Queue from "bull";
import { runModel } from "../Utils/APIs/wavespeed_calling";
const redisPort = process.env.REDIS_PORT as string
  ? parseInt(process.env.REDIS_PORT as string, 10)
  : 6379;

export const taskQueue = new Queue("modelProcessing", {
  redis: {
    host: process.env.REDIS_HOST as string,
    port: redisPort,
    password: process.env.REDIS_PASSWORD as string || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    timeout: 300000,
  },
});

taskQueue.process(async (job) => {
  try {
    const { modelName, type, data } = job.data;
    console.log(`Processing job ${job.id} for model ${modelName}`);
    await job.progress(0);
    await job.update({
      status: "starting",
      startedAt: new Date(),
      modelName,
      type,
    });

    const result = await runModel(modelName, type, data, job);
    await job.update({
      completedAt: new Date(),
      status: "success",
    });
    job.progress(100);
    return { success: true, result };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    await job.update({
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      failedAt: new Date(),
    });
    throw error;
  }
});

taskQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

taskQueue.on("failed", (job, error) => {
  console.error(`Job ${job.id} failed with error:`, error.message);
});

taskQueue.on("stalled", (job) => {
  console.warn(`Job ${job.id} stalled`);
});

export default taskQueue;
