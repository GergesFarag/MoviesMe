import { UserRepository } from '../Repositories/UserRepository';
import { JobRepository, JobCreationData } from '../Repositories/JobRepository';
import {
  StoryRepository,
  StoryCreationData,
  InitialStoryData,
  StoryUpdateData,
} from '../Repositories/StoryRepository';
import AppError, { HTTP_STATUS_CODE } from '../Utils/Errors/AppError';

export interface ItemData {
  URL: string;
  modelType: string;
  jobId: string;
  status: string;
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  duration: number;
}

export class RepositoryOrchestrationService {
  private static instance: RepositoryOrchestrationService;
  private userRepository: UserRepository;
  private jobRepository: JobRepository;
  private storyRepository: StoryRepository;

  private constructor() {
    this.userRepository = UserRepository.getInstance();
    this.jobRepository = JobRepository.getInstance();
    this.storyRepository = StoryRepository.getInstance();
  }

  public static getInstance(): RepositoryOrchestrationService {
    if (!RepositoryOrchestrationService.instance) {
      RepositoryOrchestrationService.instance =
        new RepositoryOrchestrationService();
    }
    return RepositoryOrchestrationService.instance;
  }


  async createJobAndUpdateUser(
    userId: string,
    jobData: JobCreationData,
    itemData: ItemData
  ) {
    const createdJob: any = await this.jobRepository.createJobWithData(jobData);

    await this.userRepository.addEffectItemAndJob(userId, itemData, {
      _id: createdJob._id,
      jobId: createdJob.jobId,
    });

    return createdJob;
  }


  async createStoryAndUpdateUser(storyData: StoryCreationData) {
    const createdStory = await this.storyRepository.createCompletedStory(
      storyData
    );

    const user = await this.userRepository.addStoryToLibrary(
      storyData.userId,
      createdStory._id as any
    );

    if (!user) {
      throw new AppError('User not found', HTTP_STATUS_CODE.NOT_FOUND);
    }

    await this.jobRepository.updateJobStatus(storyData.jobId, 'completed');

    return createdStory;
  }


  async createInitialStoryAndUpdateUser(
    userId: string,
    jobId: string,
    storyData: InitialStoryData
  ) {
    const createdStory = await this.storyRepository.createInitialStory(
      userId,
      jobId,
      storyData
    );

    const user = await this.userRepository.addStoryToLibrary(
      userId,
      createdStory._id as any
    );

    if (!user) {
      await this.storyRepository.delete(String(createdStory._id));
      throw new AppError('User not found', HTTP_STATUS_CODE.NOT_FOUND);
    }

    return createdStory;
  }

  async updateCompletedStory(jobId: string, updateData: StoryUpdateData) {
    const updatedStory = await this.storyRepository.updateCompletedStory(
      jobId,
      updateData
    );

    if (!updatedStory) {
      throw new AppError(
        'Failed to update story',
        HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }

    const jobUpdate: any = await this.jobRepository.updateJobStatus(
      jobId,
      'completed'
    );

    if (!jobUpdate) {
      console.warn(
        `Job not found for jobId: ${jobId}, but story was updated successfully`
      );
    } else {
      console.log(`Job updated successfully: ${jobUpdate._id}`);
    }

    return updatedStory;
  }

  async createJobForStory(
    userId: string,
    jobId: string,
    modelId?: string
  ): Promise<void> {
    try {
      console.log(
        `Creating job for story - userId: ${userId}, jobId: ${jobId}`
      );

      const createdJob: any = await this.jobRepository.createStoryJob(
        userId,
        jobId,
        modelId
      );

      console.log(`Job created successfully: ${createdJob._id}`);

      const userUpdate = await this.userRepository.addJobToUser(userId, {
        _id: createdJob._id,
        jobId: createdJob.jobId,
      });

      if (!userUpdate) {
        console.error(`Failed to update user jobs for userId: ${userId}`);
        await this.jobRepository.delete(String(createdJob._id));
        throw new AppError(
          'Failed to update user with job',
          HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
        );
      }

      console.log(`User jobs updated successfully for userId: ${userId}`);
    } catch (error) {
      console.error('Error in createJobForStory:', error);
      throw error;
    }
  }
}
