import { IStoryRequest } from '../Interfaces/storyRequest.interface';
import { StoryGenerationInfoRepository } from '../Repositories/StoryGenerationInfoRepository';
import { RepositoryOrchestrationService } from '../Services/repositoryOrchestration.service';
import storyQueue from '../Queues/story.queue';
import { StoryProcessingDTO } from '../DTOs/storyRequest.dto';
import AppError from '../Utils/Errors/AppError';
import Job from '../Models/job.model';
import { JobRepository } from '../Repositories/JobRepository';

const jobRepository = JobRepository.getInstance();

export const processStoryJobAsnc = async (
  storyData: IStoryRequest,
  userId: string,
  jobId?: string
) => {
  const storyGenerationInfoRepository =
    StoryGenerationInfoRepository.getInstance();
  let location, style;
  if (storyData.storyLocationId) {
    location = await storyGenerationInfoRepository.getLocationName(
      storyData.storyLocationId
    );
    if (!location) {
      throw new AppError('Invalid location ID provided', 400);
    }
  }

  if (storyData.storyStyleId) {
    style = await storyGenerationInfoRepository.getStyleName(
      storyData.storyStyleId
    );
    if (!style) {
      throw new AppError('Invalid style ID provided', 400);
    }
  }

  if (jobId) {
    const existingJob = await jobRepository.findByJobId(jobId);
    if (existingJob) {
      if (existingJob.status === 'failed') {
        throw new AppError(
          'Cannot retry failed job. Please create a new story.',
          400
        );
      }
      if (existingJob.status === 'completed') {
        throw new AppError('Job already completed.', 400);
      }
      if (existingJob.status === 'pending') {
        throw new AppError('Job is already being processed.', 409);
      }
    }

    const orchestrationService = RepositoryOrchestrationService.getInstance();
    await orchestrationService.createJobForStory(userId, jobId);
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
