import { IStory } from '../Interfaces/story.interface';
import Story from '../Models/story.model';
import { JobStatus } from '../types/job';
import { BaseRepository } from './BaseRepository';
import AppError from '../Utils/Errors/AppError';
import { HTTP_STATUS_CODE } from '../Enums/error.enum';

export interface StoryCreationData {
  userId: string;
  title: string;
  scenes: any[];
  videoUrl: string;
  duration: number;
  genre?: string;
  jobId: string;
  location?: string;
  prompt: string;
  style: string;
  thumbnail: string;
  voiceOver?: {
    sound: string;
    text: string;
  };
}

export interface InitialStoryData {
  title: string;
  prompt: string;
  credits: number;
  genre?: string | null;
  location?: string | null;
  style?: string | null;
  duration: number;
  thumbnail?: string;
  refImage?: string | null;
}

export interface StoryUpdateData {
  videoUrl: string | null;
  scenes: any[];
  thumbnail?: string | null;
  location?: string | null;
  style?: string | null;
  title?: string | null;
  genre?: string | null;
  voiceOver?: {
    sound: string | null;
    text: string | null;
  } | null;
  refImage?: string | null;
}

export class StoryRepository extends BaseRepository<IStory> {
  private static instance: StoryRepository;

  private constructor() {
    super(Story);
  }

  public static getInstance(): StoryRepository {
    if (!StoryRepository.instance) {
      StoryRepository.instance = new StoryRepository();
    }
    return StoryRepository.instance;
  }

  async findByJobId(jobId: string): Promise<IStory | null> {
    return this.findOne({ jobId });
  }

  async updateStoryStatus(
    jobId: string,
    status: JobStatus
  ): Promise<IStory | null> {
    return this.model.findOneAndUpdate(
      { jobId },
      { status, updatedAt: new Date() },
      { new: true }
    );
  }

  async createCompletedStory(storyData: StoryCreationData): Promise<IStory> {
    return this.create({
      ...storyData,
      status: 'completed',
      isFav: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async createInitialStory(
    userId: string,
    jobId: string,
    storyData: InitialStoryData
  ): Promise<IStory> {
    return this.create({
      userId: userId as any,
      jobId,
      title: storyData.title || 'Generating...',
      prompt: storyData.prompt,
      status: 'pending',
      isFav: false,
      videoUrl: null,
      duration: storyData.duration,
      genre: storyData.genre || null,
      location: storyData.location || null,
      style: storyData.style || null,
      thumbnail: storyData.thumbnail || null,
      refImage: storyData.refImage || null,
      scenes: [],
      voiceOver: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credits: storyData.credits,
    } as any);
  }

  async updateCompletedStory(
    jobId: string,
    updateData: StoryUpdateData
  ): Promise<IStory | null> {
    try {
      if (!jobId) {
        throw new AppError(
          'Job ID is required for story update',
          HTTP_STATUS_CODE.BAD_REQUEST
        );
      }

      console.log(`Updating story for jobId: ${jobId}`);
      console.log('Update data:', updateData);

      const existingStory = await this.findByJobId(jobId);
      if (!existingStory) {
        console.error(`Story not found for jobId: ${jobId}`);
        throw new AppError('Story not found', HTTP_STATUS_CODE.NOT_FOUND);
      }

      if (existingStory.status === 'completed') {
        console.log(
          `Story with jobId: ${jobId} is already completed. Returning existing story.`
        );
        return existingStory;
      }

      if (existingStory.status === 'failed') {
        console.log(
          `Story with jobId: ${jobId} was marked as failed, but updating to completed.`
        );
      }

      const updateFields: any = {
        status: 'completed',
        updatedAt: new Date(),
      };

      updateFields.videoUrl = updateData.videoUrl;

      if (updateData.scenes && updateData.scenes.length > 0) {
        updateFields.scenes = updateData.scenes;
      }

      updateFields.thumbnail = updateData.thumbnail;

      if (updateData.location) {
        updateFields.location = updateData.location;
      }

      if (updateData.style) {
        updateFields.style = updateData.style;
      }

      if (updateData.title) {
        updateFields.title = updateData.title;
      }

      if (updateData.genre) {
        updateFields.genre = updateData.genre;
      }

      if (
        updateData.voiceOver &&
        updateData.voiceOver.sound &&
        updateData.voiceOver.text
      ) {
        updateFields.voiceOver = updateData.voiceOver;
      }

      if (updateData.refImage) {
        updateFields.refImage = updateData.refImage;
      }

      const updatedStory = await this.model.findOneAndUpdate(
        { jobId },
        updateFields,
        {
          new: true,
        }
      );

      if (!updatedStory) {
        throw new AppError(
          'Failed to update story',
          HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
        );
      }

      console.log(`Story updated successfully: ${updatedStory._id}`);
      return updatedStory;
    } catch (error) {
      console.error('Error in updateCompletedStory:', error);
      throw error;
    }
  }
}
