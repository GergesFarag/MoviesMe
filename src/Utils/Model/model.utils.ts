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
  io?: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  event?: string,
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
    
    if (io && event) {
      try {
        const payload = {
          jobId: job.id,
          status,
          progress,
          ...additionalData,
          timestamp: Date.now(),
        };
        
        const roomName = `user:${job.data.userId}`;
        
        // Check if there are clients in the room before sending
        const room = io.sockets.adapter.rooms.get(roomName);
        if (room && room.size > 0) {
          sendWebsocket(io, event, payload, roomName);
          console.log(`✅ Job progress sent to ${room.size} client(s) in room ${roomName}:`, payload);
        } else {
          console.warn(`⚠️ No clients connected for user ${job.data.userId}, progress not sent:`, payload);
          
          // Store progress in job data for client to retrieve when reconnecting
          await job.update({
            ...(job.data || {}),
            status,
            progress,
            lastProgressUpdate: payload,
            ...additionalData,
          });
        }
      } catch (err) {
        console.error("❌ Error updating job progress via WebSocket:", err);
        
        // Don't throw error - job should continue even if WebSocket fails
        // Store the progress in the job data as fallback
        try {
          await job.update({
            ...(job.data || {}),
            status,
            progress,
            lastProgressUpdate: {
              jobId: job.id,
              status,
              progress,
              ...additionalData,
              timestamp: Date.now(),
              websocketError: true
            },
            ...additionalData,
          });
          console.log("💾 Progress stored in job data as fallback");
        } catch (updateError) {
          console.error("❌ Failed to store progress in job data:", updateError);
        }
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
    "Content-Type": "application/json",
    Authorization: `Bearer ${WAVESPEED_API_KEY}`,
  };

  return { formattedModel, url, headers };
};
