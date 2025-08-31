import Bull from "bull";
import { getIO } from "../../Config/socketio";
import AppError from "../Errors/AppError";
import { formatModelName } from "../Format/modelNames";
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

export const updateJobProgress = async (
  job: Bull.Job,
  progress: number,
  status: string,
  additionalData: Record<string, any> = {}
) => {
  if (job) {
    await job.progress(progress);
    await job.update({
      ...(job.data || {}),
      status,
      progress,
      ...additionalData,
    });
    try {
      const io = getIO();
      const payload = {
        jobId: job.id,
        status,
        progress,
        ...additionalData,
        timestamp: Date.now(),
      };
      console.log("USERID: ", job.data.userId);
      if (job.data?.userId) {
        io.to(`user:${job.data.userId}`).emit("job:progress", payload);
      }
      console.log("Sending Job Status: ", payload);
    } catch (err) {
      console.log("Error updating job progress:", err);
      throw new AppError("Socket.io not initialized");
    }
  }
};

export const processModelData = async (
  modelName: string,
  modelType: string,
  data: any
) => {
  const formattedModel = formatModelName(modelName, modelType);
  const url = `https://api.wavespeed.ai/api/v3/${formattedModel}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${WAVESPEED_API_KEY}`,
  };

  return { formattedModel, url, headers };
};
