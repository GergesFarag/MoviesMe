import { Types } from 'mongoose';
import User from '../Models/user.model';
import JobModel from '../Models/job.model';
import { generationLibQueue } from '../Queues/generationLib.queue';
import {
  IGenerationLibRequestDTO,
  IGenerationLibResponseDTO,
  GenerationLibDTO,
} from '../DTOs/generationLib.dto';
import AppError from '../Utils/Errors/AppError';
import { IGenerationLibJobData } from '../Queues/Handlers/generationLibHandlers';
import { Sorting } from '../Utils/Sorting/sorting';
import { IGenerationInfo } from '../Interfaces/generationInfo.interface';
import GenerationInfo from '../Models/generation.model';
import { IGenerationLib } from '../Interfaces/generationLib.interface';
import { UserRepository } from '../Repositories/UserRepository';
import { JobRepository } from '../Repositories/JobRepository';
import { GenerationInfoRepository } from '../Repositories/GenerationInfoRepository';

export class GenerationLibService {
  private userRepository: UserRepository;
  private jobRepository: JobRepository;
  private generationInfoRepository: GenerationInfoRepository;

  constructor() {
    this.userRepository = UserRepository.getInstance();
    this.jobRepository = JobRepository.getInstance();
    this.generationInfoRepository = GenerationInfoRepository.getInstance();
  }
  async createGeneration(
    userId: string,
    jobId: string,
    requestData: IGenerationLibRequestDTO
  ): Promise<IGenerationLibResponseDTO> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      await this.jobRepository.create({
        jobId,
        userId: userId as any,
        status: 'pending',
        createdAt: new Date(),
      });

      if (!user.generationLib) {
        user.generationLib = [];
      }

      const newGenerationItem: IGenerationLib = {
        _id: new Types.ObjectId(),
        jobId,
        URL: null,
        status: 'pending',
        thumbnail: null,
        duration: requestData.isVideo ? 5 : 0,
        data: requestData,
        createdAt: new Date(),
        updatedAt: new Date(),
        credits: requestData.credits || 0,
        isVideo: requestData.isVideo || false,
        isFav: false,
      };

      await this.userRepository.findByIdAndUpdate(userId, {
        $push: { generationLib: newGenerationItem },
      });

      const jobData: IGenerationLibJobData = {
        userId,
        prompt: requestData.prompt,
        refImages: requestData.refImages,
        isVideo: requestData.isVideo,
        duration: requestData.duration || 0,
        modelId: requestData.modelId,
        credits: requestData.credits || 0,
        jobId,
      };
      await generationLibQueue.add(jobData, {
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      console.log(
        `✅ GenerationLib job ${jobId} added to queue for user ${userId}`
      );

      return {
        success: true,
        message: 'Generation task created successfully',
        jobId,
        data: new GenerationLibDTO(newGenerationItem as any).toDTO(
          newGenerationItem as any
        ),
      };
    } catch (error) {
      console.error('Error creating generation task:', error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to create generation task',
        500
      );
    }
  }

  async getUserGenerations(
    userId: string,
    query: Record<string, string>
  ): Promise<any[]> {
    try {
      const user = await this.userRepository.findById(userId, 'generationLib');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.generationLib || user.generationLib.length === 0) {
        return [];
      }

      let filteredGenerations = [...user.generationLib];

      // Apply status filter if provided
      if (query.status && query.status !== 'all') {
        filteredGenerations = filteredGenerations.filter(
          (generation: any) => generation.status === query.status
        );
      }

      // Apply favorite filter if provided
      if (query.isFav !== undefined) {
        const isFavValue = query.isFav === 'true';
        filteredGenerations = filteredGenerations.filter(
          (generation: any) => generation.isFav === isFavValue
        );
      }

      const sortedGenerations = Sorting.sortItems(
        filteredGenerations,
        'newest'
      );
      return GenerationLibDTO.toDTOArray(sortedGenerations);
    } catch (error) {
      console.error('Error getting user generations:', error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to get user generations',
        500
      );
    }
  }

  async getGenerationById(userId: string, generationId: string): Promise<any> {
    try {
      const user = await this.userRepository.findById(userId, 'generationLib');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.generationLib) {
        throw new AppError('Generation not found', 404);
      }

      const generation = user.generationLib.find(
        (item) => item._id.toString() === generationId
      );

      if (!generation) {
        throw new AppError('Generation not found', 404);
      }

      return new GenerationLibDTO(generation).toDTO(generation);
    } catch (error) {
      console.error('Error getting generation by ID:', error);
      throw new AppError(
        error instanceof Error ? error.message : 'Failed to get generation',
        500
      );
    }
  }

  async updateFavoriteStatus(
    userId: string,
    generationId: string
  ): Promise<any> {
    try {
      const user = await this.userRepository.findById(userId, 'generationLib');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.generationLib) {
        throw new AppError('Generation not found', 404);
      }

      const generationIndex = user.generationLib.findIndex(
        (item) => item._id.toString() === generationId
      );

      if (generationIndex === -1) {
        throw new AppError('Generation not found', 404);
      }

      const isFav = !user.generationLib[generationIndex].isFav;

      await this.userRepository.findByIdAndUpdate(userId, {
        $set: {
          [`generationLib.${generationIndex}.isFav`]: isFav,
          [`generationLib.${generationIndex}.updatedAt`]: new Date(),
        },
      });

      const updatedUser = await this.userRepository.findById(
        userId,
        'generationLib'
      );
      const updatedGeneration = updatedUser?.generationLib?.[generationIndex];

      if (!updatedGeneration) {
        throw new AppError('Failed to update favorite status', 500);
      }

      return new GenerationLibDTO(updatedGeneration).toDTO(updatedGeneration);
    } catch (error) {
      console.error('Error updating favorite status:', error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to update favorite status',
        500
      );
    }
  }

  async deleteGeneration(userId: string, generationId: string): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId, 'generationLib');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.generationLib) {
        throw new AppError('Generation not found', 404);
      }

      const generationIndex = user.generationLib.findIndex(
        (item) => item._id.toString() === generationId
      );

      if (generationIndex === -1) {
        throw new AppError('Generation not found', 404);
      }
      const generationItem = user.generationLib[generationIndex];
      const jobId = generationItem.jobId;

      await this.userRepository.findByIdAndUpdate(userId, {
        $pull: { generationLib: { _id: new Types.ObjectId(generationId) } },
      });
      await this.userRepository.findByIdAndUpdate(userId, {
        $pull: { jobs: { jobId } },
      });

      if (jobId) {
        await this.jobRepository.delete(String(jobId));
        console.log(`✅ Deleted job ${jobId} for generation ${generationId}`);
      }

      console.log(`✅ Deleted generation ${generationId} for user ${userId}`);
    } catch (error) {
      console.error('Error deleting generation:', error);
      throw new AppError(
        error instanceof Error ? error.message : 'Failed to delete generation',
        500
      );
    }
  }

  async getUserVideoGenerations(
    userId: string,
    query: Record<string, string>
  ): Promise<any[]> {
    try {
      const user = await this.userRepository.findById(userId, 'generationLib');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.generationLib || user.generationLib.length === 0) {
        return [];
      }

      // Filter video generations
      let videoGenerations = user.generationLib.filter(
        (generation: any) => generation.isVideo === true
      );

      // Apply status filter if provided
      if (query.status && query.status !== 'all') {
        videoGenerations = videoGenerations.filter(
          (generation: any) => generation.status === query.status
        );
      }

      // Apply favorite filter if provided
      if (query.isFav !== undefined) {
        const isFavValue = query.isFav === 'true';
        videoGenerations = videoGenerations.filter(
          (generation: any) => generation.isFav === isFavValue
        );
      }

      const sortedVidGenerations = Sorting.sortItems(
        videoGenerations,
        'newest'
      );
      return GenerationLibDTO.toDTOArray(sortedVidGenerations);
    } catch (error) {
      console.error('Error getting user video generations:', error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to get user video generations',
        500
      );
    }
  }

  async getUserImageGenerations(
    userId: string,
    query: Record<string, string>
  ): Promise<any[]> {
    try {
      const user = await this.userRepository.findById(userId, 'generationLib');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.generationLib || user.generationLib.length === 0) {
        return [];
      }

      // Filter image generations
      let imageGenerations = user.generationLib.filter(
        (generation: any) => generation.isVideo === false
      );

      // Apply status filter if provided
      if (query.status && query.status !== 'all') {
        imageGenerations = imageGenerations.filter(
          (generation: any) => generation.status === query.status
        );
      }

      // Apply favorite filter if provided
      if (query.isFav !== undefined) {
        const isFavValue = query.isFav === 'true';
        imageGenerations = imageGenerations.filter(
          (generation: any) => generation.isFav === isFavValue
        );
      }

      const sortedImgGenerations = Sorting.sortItems(
        imageGenerations,
        'newest'
      );
      return GenerationLibDTO.toDTOArray(sortedImgGenerations);
    } catch (error) {
      console.error('Error getting user image generations:', error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to get user image generations',
        500
      );
    }
  }

  async getGenerationInfo(): Promise<IGenerationInfo | null> {
    try {
      const generations =
        await this.generationInfoRepository.getGenerationInfo();
      if (!generations) {
        throw new AppError('Generation info not found', 404);
      }
      return generations;
    } catch (error) {
      console.error('Error getting generation info:', error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to get generation info',
        500
      );
    }
  }

  async updateGenerationInfo(
    updates: Partial<IGenerationInfo>
  ): Promise<IGenerationInfo> {
    try {
      let generationInfo =
        await this.generationInfoRepository.getGenerationInfo();
      if (!generationInfo) {
        generationInfo = (await this.generationInfoRepository.create(
          updates
        )) as any;
      } else {
        generationInfo =
          (await this.generationInfoRepository.updateGenerationInfo(
            updates
          )) as any;
      }
      if (!generationInfo) {
        throw new AppError('Failed to update generation info', 500);
      }
      return generationInfo;
    } catch (error) {
      console.error('Error updating generation info:', error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : 'Failed to update generation info',
        500
      );
    }
  }
}
