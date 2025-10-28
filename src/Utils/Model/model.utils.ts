import Bull from 'bull';
import { getIO, sendWebsocket } from '../../Sockets/socket';
import AppError from '../Errors/AppError';
import { formatModelName } from '../Format/modelNames';
import { DefaultEventsMap, Server } from 'socket.io';
import {
  IGenerationImageLibModel,
  IGenerationVideoLibModel,
} from '../../Interfaces/aiModel.interface';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

const safeJobUpdate = async (
  job: Bull.Job,
  data: any,
  retries = 2
): Promise<void> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const jobExists =
        (await job.isActive()) ||
        (await job.isWaiting()) ||
        (await job.isDelayed());
      if (jobExists) {
        await job.update(data);
        return; // Success
      } else {
        console.warn(`⚠️ Job ${job.id} no longer exists in queue`);
        return;
      }
    } catch (error) {
      if (i === retries) {
        throw error; // Final attempt failed
      }
      console.warn(`⚠️ Job update attempt ${i + 1} failed, retrying...`, error);
      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1))); // Exponential backoff
    }
  }
};

export const updateJobProgress = async (
  job: Bull.Job,
  progress: number,
  status: string,
  io?: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  event?: string
) => {
  if (job) {
    try {
      await job.progress(progress);

      const updatedData = {
        ...(job.data || {}),
        status,
        progress,
        lastUpdate: Date.now(),
      };

      await safeJobUpdate(job, updatedData);
    } catch (updateError) {
      console.error(`❌ Error updating job ${job.id} data:`, updateError);
    }

    if (io && event) {
      try {
        const jobId = job.data.jobId || job.id;
        const payload = {
          jobId: jobId,
          status,
          progress,
          timestamp: Date.now(),
        };

        const roomName = `user:${job.data.userId}`;

        const room = io.sockets.adapter.rooms.get(roomName);
        if (room && room.size > 0) {
          sendWebsocket(io, event, payload, roomName);
          console.log(
            `✅ Job progress sent to ${room.size} client(s) in room ${roomName}:`,
            payload
          );
        }
      } catch (err) {
        console.error('❌ Error updating job progress via WebSocket:', err);
      }
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
    'Content-Type': 'application/json',
    Authorization: `Bearer ${WAVESPEED_API_KEY}`,
  };

  return { formattedModel, url, headers };
};
