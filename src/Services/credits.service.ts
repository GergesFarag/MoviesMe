import { ICreditService } from "../Interfaces/credits.model";
import User from "../Models/user.model";
import { MAX_CREDITS_AMT, MIN_CREDITS_AMT } from "../Constants/credits";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import Model from "../Models/ai.model";
import GenerationInfo from "../Models/generation.model";
import StoryGenerationInfo from "../Models/storyGenerationInfo.model";
import { Types } from "mongoose";

export class CreditService implements ICreditService {
  async addCredits(userId: string, credits: number): Promise<boolean> {
    try {
      if (credits < MIN_CREDITS_AMT || credits > MAX_CREDITS_AMT) {
        throw new AppError(
          "Invalid credit amount",
          HTTP_STATUS_CODE.BAD_REQUEST
        );
      }
      console.log("Adding Credits ", credits, "To User ", userId);
      const user = await User.findById(new Types.ObjectId(userId));
      if (!user) {
        throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
      }
      user.credits += credits;
      await user.save();
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(`${error.message}`);
      } else {
        throw new AppError(`Failed to add credits: ${error}`);
      }
    }
  }

  async deductCredits(userId: string, credits: number): Promise<boolean> {
    console.log("Triggered");
    try {
      if (credits < MIN_CREDITS_AMT || credits > MAX_CREDITS_AMT) {
        throw new AppError("Invalid credit amount");
      }
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found");
      }
      user.credits -= credits;
      await user.save();
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(`${error.message}`);
      } else {
        throw new AppError(`Failed to deduct credits: ${error}`);
      }
    }
  }

  async getCredits(userId: string): Promise<number> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    return user.credits;
  }

  async hasSufficientCredits(
    userId: string,
    credits: number
  ): Promise<boolean> {
    const currentCredits = await this.getCredits(userId);
    return currentCredits >= credits;
  }

  async getModelCredits(modelId: string): Promise<number> {
    const model = await Model.findById(modelId);
    if (!model) {
      throw new AppError("Model not found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    return model.credits;
  }

  async getGenerationModelCredits(
    modelId: string,
    isVideo: boolean = false
  ): Promise<number | Map<string, number>[]> {
    const generationInfo = await GenerationInfo.findOne().lean();
    if (!generationInfo || !generationInfo.videoModels) {
      throw new AppError(
        "Generation info not found",
        HTTP_STATUS_CODE.NOT_FOUND
      );
    }
    if (isVideo) {
      const videoModel = generationInfo.videoModels.find(
        (m) => m._id.toString() === modelId.toString()
      );
      if (!videoModel) {
        throw new AppError("Video Model not found", HTTP_STATUS_CODE.NOT_FOUND);
      }
      const credits: Map<string, number>[] = videoModel.credits.map(
        (creditMap) => {
          return new Map(Object.entries(creditMap));
        }
      );
      return credits;
    } else {
      const imageModel = generationInfo.imageModels.find(
        (m) => m._id.toString() === modelId.toString()
      );
      if (!imageModel) {
        throw new AppError("Image Model not found", HTTP_STATUS_CODE.NOT_FOUND);
      }
      return imageModel.credits;
    }
  }

  async getStoryCredits(
    numOfScenes: number,
    hasVoiceOver: boolean = false
  ): Promise<number> {
    const storyGenerationInfo = await StoryGenerationInfo.findOne().lean();
    if (!storyGenerationInfo) {
      throw new AppError(
        "Story Generation info not found",
        HTTP_STATUS_CODE.NOT_FOUND
      );
    }
    if (numOfScenes <= 0) {
      throw new AppError(
        "Number of scenes must be greater than zero",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }
    let totalCredits = 0;
    totalCredits += storyGenerationInfo.generationCredits * numOfScenes;
    if (hasVoiceOver) {
      totalCredits += storyGenerationInfo.voiceOverCredits * numOfScenes;
    }
    return totalCredits;
  }

  isValidCredits(credits: number, calculatedCredits: number): boolean {
    console.log("Credits", credits, "Calculated Credits", calculatedCredits);
    return credits === calculatedCredits;
  }
}
