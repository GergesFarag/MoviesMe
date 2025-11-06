import { IStoryRequest } from '../Interfaces/storyRequest.interface';
import { StoryGenerationInfoRepository } from '../Repositories/StoryGenerationInfoRepository';
import { RepositoryOrchestrationService } from '../Services/repositoryOrchestration.service';
import storyQueue from '../Queues/story.queue';
import { StoryProcessingDTO } from '../DTOs/storyRequest.dto';
import AppError from '../Utils/Errors/AppError';
import Job from '../Models/job.model';
import { JobRepository } from '../Repositories/JobRepository';
import { sendWebsocket } from '../Sockets/socket';

const jobRepository = JobRepository.getInstance();

export const QUEUE_EVENTS = {
  STORY_PROGRESS: 'story:progress',
  STORY_COMPLETED: 'story:completed',
  STORY_FAILED: 'story:failed',
} as const;

const progressIntervals: Map<string, NodeJS.Timeout> = new Map();

export const startProgressUpdates = (
  userId: string,
  jobId: string,
  startProgress: number,
  endProgress: number,
  step: string
): void => {
  stopProgressUpdates(jobId);

  let currentProgress = startProgress;
  const interval = setInterval(() => {
    if (currentProgress < endProgress) {
      currentProgress += 1;

      sendWebsocket(
        QUEUE_EVENTS.STORY_PROGRESS,
        {
          jobId,
          progress: currentProgress,
          step,
          message: `${step}: ${currentProgress}%`,
        },
        `user:${userId}`
      );

      console.log(
        `📊 Progress update sent: ${jobId} - ${step} - ${currentProgress}%`
      );
    }
  }, 3000);

  progressIntervals.set(jobId, interval);
};

export const stopProgressUpdates = (jobId: string): void => {
  const interval = progressIntervals.get(jobId);
  if (interval) {
    clearInterval(interval);
    progressIntervals.delete(jobId);
    console.log(`🛑 Stopped progress updates for job: ${jobId}`);
  }
};

export const sendProgressUpdate = (
  userId: string,
  jobId: string,
  progress: number,
  step: string
): void => {
  sendWebsocket(
    QUEUE_EVENTS.STORY_PROGRESS,
    {
      jobId,
      progress,
      step,
      message: `${step}: ${progress}%`,
    },
    `user:${userId}`
  );
  console.log(`📊 Progress update: ${jobId} - ${step} - ${progress}%`);
};

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
