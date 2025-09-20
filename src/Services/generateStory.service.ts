import { UploadApiResponse } from "cloudinary";
import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import { cloudUpload } from "../Utils/APIs/cloudinary";
import { getLocationName, getStyleName, createJobForStory } from "../Utils/Database/optimizedOps";
import { VideoGenerationService } from "./videoGeneration.service";
import { OpenAIService } from "./openAi.service";
import { IStoryResponse } from "../Interfaces/storyResponse.interface";
import storyQueue from "../Queues/story.queue";
import { StoryProcessingDTO } from "../DTOs/storyRequest.dto";
import AppError from "../Utils/Errors/AppError";
import Job from "../Models/job.model";

// Rate limiting for job creation
const jobCreationCache = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_JOBS_PER_USER = 3; // Max 3 jobs per user per minute

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of jobCreationCache.entries()) {
    const recentJobs = timestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (recentJobs.length === 0) {
      jobCreationCache.delete(userId);
    } else {
      jobCreationCache.set(userId, recentJobs);
    }
  }
}, RATE_LIMIT_WINDOW);

export const processStoryJobAsnc = async (
  storyData: IStoryRequest,
  userId: string,
  jobId?: string
) => {
  const userKey = `user:${userId}`;
  const now = Date.now();
  
  if (!jobCreationCache.has(userKey)) {
    jobCreationCache.set(userKey, []);
  }
  
  const userJobs = jobCreationCache.get(userKey)!;
  const recentJobs = userJobs.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentJobs.length >= MAX_JOBS_PER_USER) {
    throw new AppError(
      `Too many story generation requests. You can create ${MAX_JOBS_PER_USER} stories per minute. Please wait before creating another.`, 
      429
    );
  }
  
  recentJobs.push(now);
  jobCreationCache.set(userKey, recentJobs);

  let location, style;
  if (storyData.storyLocationId) {
    location = await getLocationName(storyData.storyLocationId);
    if (!location) {
      throw new AppError("Invalid location ID provided", 400);
    }
  }

  if (storyData.storyStyleId) {
    style = await getStyleName(storyData.storyStyleId);
    if (!style) {
      throw new AppError("Invalid style ID provided", 400);
    }
  }

  if (jobId) {
    const existingJob = await Job.findOne({ jobId });
    if (existingJob) {
      if (existingJob.status === "failed") {
        throw new AppError("Cannot retry failed job. Please create a new story.", 400);
      }
      if (existingJob.status === "completed") {
        throw new AppError("Job already completed.", 400);
      }
      if (existingJob.status === "pending") {
        throw new AppError("Job is already being processed.", 409);
      }
    }
    
    await createJobForStory(userId, jobId);
  }

  const processingStory = new StoryProcessingDTO(storyData).toDTO(
    style || null,
    location || null
  );

  const job = await storyQueue.add(
    {
      ...processingStory,
      userId, 
      jobId, 
    },
    {
      jobId: jobId,
    }
  );

  return job.data;
};
