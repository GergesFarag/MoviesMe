import Bull from "bull";
import { getIO, sendWebsocket } from "../../Sockets/socket";
import AppError from "../Errors/AppError";
import { formatModelName } from "../Format/modelNames";
import { DefaultEventsMap, Server } from "socket.io";
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

export const updateJobProgress = async (
  job: Bull.Job,
  progress: number,
  status: string,
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  event: string,
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
      const payload = {
        jobId: job.id,
        status,
        progress,
        ...additionalData,
        timestamp: Date.now(),
      };
      sendWebsocket(io, event, payload, `user:${job.data.userId}`);
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
