import { Types } from "mongoose";
import User from "../Models/user.model";
import JobModel from "../Models/job.model";
import { generationLibQueue } from "../Queues/generationLib.queue";
import {
  IGenerationLibRequestDTO,
  IGenerationLibResponseDTO,
  GenerationLibDTO,
} from "../DTOs/generationLib.dto";
import AppError from "../Utils/Errors/AppError";
import { IGenerationLibJobData } from "../Queues/Handlers/generationLibHandlers";
import { Sorting } from "../Utils/Sorting/sorting";
import { IGenerationInfo } from "../Interfaces/generationInfo.interface";
import GenerationInfo from "../Models/generation.moel";

export class GenerationLibService {
  async createGeneration(
    userId: string,
    requestData: IGenerationLibRequestDTO
  ): Promise<IGenerationLibResponseDTO> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const jobId = new Types.ObjectId().toString();

      const jobRecord = new JobModel({
        jobId,
        userId,
        status: "pending",
        createdAt: new Date(),
      });
      await jobRecord.save();

      if (!user.generationLib) {
        user.generationLib = [];
      }

      const newGenerationItem = {
        _id: new Types.ObjectId(),
        jobId,
        URL: null,
        status: "pending",
        thumbnail: null,
        duration: requestData.isVideo ? 10 : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isVideo: requestData.isVideo || false,
        isFav: false,
      };

      (user.generationLib as any).push(newGenerationItem);
      await user.save();

      const jobData: IGenerationLibJobData = {
        userId,
        prompt: requestData.prompt,
        refImages: requestData.refImages,
        isVideo: requestData.isVideo,
        size: requestData.size,
        jobId,
      };
      await generationLibQueue.add(jobData, {
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      });

      console.log(
        `✅ GenerationLib job ${jobId} added to queue for user ${userId}`
      );

      return {
        success: true,
        message: "Generation task created successfully",
        jobId,
        data: new GenerationLibDTO(newGenerationItem as any).toDTO(
          newGenerationItem as any
        ),
      };
    } catch (error) {
      console.error("Error creating generation task:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to create generation task",
        500
      );
    }
  }

  async getUserGenerations(userId: string): Promise<any[]> {
    try {
      const user = await User.findById(userId).select("generationLib");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.generationLib || user.generationLib.length === 0) {
        return [];
      }
      const sortedGenerations = Sorting.sortItems(user.generationLib, "newest");
      return GenerationLibDTO.toDTOArray(sortedGenerations);
    } catch (error) {
      console.error("Error getting user generations:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to get user generations",
        500
      );
    }
  }

  async getGenerationById(userId: string, generationId: string): Promise<any> {
    try {
      const user = await User.findById(userId).select("generationLib");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.generationLib) {
        throw new AppError("Generation not found", 404);
      }

      const generation = user.generationLib.find(
        (item) => item._id.toString() === generationId
      );

      if (!generation) {
        throw new AppError("Generation not found", 404);
      }

      return new GenerationLibDTO(generation).toDTO(generation);
    } catch (error) {
      console.error("Error getting generation by ID:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to get generation",
        500
      );
    }
  }

  async updateFavoriteStatus(
    userId: string,
    generationId: string,
    isFavorite: boolean
  ): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.generationLib) {
        throw new AppError("Generation not found", 404);
      }

      const generationIndex = user.generationLib.findIndex(
        (item) => item._id.toString() === generationId
      );

      if (generationIndex === -1) {
        throw new AppError("Generation not found", 404);
      }

      user.generationLib[generationIndex].isFav = isFavorite;
      user.generationLib[generationIndex].updatedAt = new Date();
      await user.save();

      return new GenerationLibDTO(user.generationLib[generationIndex]).toDTO(
        user.generationLib[generationIndex]
      );
    } catch (error) {
      console.error("Error updating favorite status:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to update favorite status",
        500
      );
    }
  }

  async deleteGeneration(userId: string, generationId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.generationLib) {
        throw new AppError("Generation not found", 404);
      }

      const generationIndex = user.generationLib.findIndex(
        (item) => item._id.toString() === generationId
      );

      if (generationIndex === -1) {
        throw new AppError("Generation not found", 404);
      }
      const generationItem = user.generationLib[generationIndex];
      const jobId = generationItem.jobId;

      user.generationLib.splice(generationIndex, 1);
      await user.save();

      if (jobId) {
        await JobModel.findOneAndDelete({ jobId: jobId });
        console.log(`✅ Deleted job ${jobId} for generation ${generationId}`);
      }

      console.log(`✅ Deleted generation ${generationId} for user ${userId}`);
    } catch (error) {
      console.error("Error deleting generation:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to delete generation",
        500
      );
    }
  }

  async getUserVideoGenerations(userId: string): Promise<any[]> {
    try {
      const user = await User.findById(userId).select("generationLib");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.generationLib || user.generationLib.length === 0) {
        return [];
      }

      const videoGenerations = user.generationLib.filter(
        (generation: any) => generation.isVideo === true
      );
      const sortedVidGenerations = Sorting.sortItems(
        videoGenerations,
        "newest"
      );
      return GenerationLibDTO.toDTOArray(sortedVidGenerations);
    } catch (error) {
      console.error("Error getting user video generations:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to get user video generations",
        500
      );
    }
  }

  async getUserImageGenerations(userId: string): Promise<any[]> {
    try {
      const user = await User.findById(userId).select("generationLib");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.generationLib || user.generationLib.length === 0) {
        return [];
      }

      // Filter only image generations
      const imageGenerations = user.generationLib.filter(
        (generation: any) => generation.isVideo === false
      );
      const sortedImgGenerations = Sorting.sortItems(
        imageGenerations,
        "newest"
      );
      return GenerationLibDTO.toDTOArray(sortedImgGenerations);
    } catch (error) {
      console.error("Error getting user image generations:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to get user image generations",
        500
      );
    }
  }

  async getGenerationInfo(): Promise<IGenerationInfo | null> {
    try {
      const generations = await GenerationInfo.findOne({});
      if (!generations) {
        throw new AppError("Generation info not found", 404);
      }
      return generations;
    } catch (error) {
      console.error("Error getting generation info:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to get generation info",
        500
      );
    }
  }
  
  async updateGenerationInfo(
    updates: Partial<IGenerationInfo>
  ): Promise<IGenerationInfo> {
    try {
      let generationInfo = await GenerationInfo.findOne({});
      if (!generationInfo) {
        generationInfo = new GenerationInfo(updates);
      } else {
        Object.assign(generationInfo, updates);
      }
      await generationInfo.save();
      return generationInfo;
    } catch (error) {
      console.error("Error updating generation info:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to update generation info",
        500
      );
    }
  }
}
