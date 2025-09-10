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

export const processStoryJobAsnc = async (
  storyData: IStoryRequest,
  userId: string,
  jobId?: string
) => {
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
