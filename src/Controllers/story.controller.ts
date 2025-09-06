import { NextFunction, Request, Response } from "express";
import catchError from "../Utils/Errors/catchError";
import Story from "../Models/story.model";
import User from "../Models/user.model";
import AppError from "../Utils/Errors/AppError";
import mongoose, { ObjectId, Types } from "mongoose";
import GenerationInfo from "../Models/generationInfo.model";
import {
  genderType,
  IStoryRequest,
} from "../Interfaces/storyRequest.interface";
import { cloudUpload } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { VideoGenerationService } from "../Services/videoGeneration.service";
import { VoiceGenerationService } from "../Services/voiceGeneration.service";
import { OpenAIService } from "../Services/openAi.service";
import { IScene } from "../Interfaces/scene.interface";
import { IStoryResponse } from "../Interfaces/storyResponse.interface";
import { getStoryGenerationData } from "../Utils/Database/optimizedOps";
import { ImageGenerationService } from "../Services/imageGeneration.service";

const storyController = {
  getAllStories: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      // const { id } = req.user!;
      // const stories = await Story.where("userId").equals(id);
      // if (!stories || stories.length === 0) {
      //   res
      //     .status(200)
      //     .json({ message: "No stories found for this user", data: [] });
      // }
      const mockStories = Array.from(
        await import("../Mock/videoGenerationAbs.json")
      );
      res
        .status(200)
        .json({ message: "Stories Fetched Successfully", data: mockStories });
    }
  ),

  getStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.user!;
      const { storyID } = req.params;
      const mockStories = Array.from(
        await import("../Mock/videoGeneration.json")
      );
      const filteredStory = mockStories.find(
        (story) => story._id === storyID
      );
      res
        .status(200)
        .json({ message: "Story Fetched Successfully", data: filteredStory });
    }
  ),

  generateStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { prompt } = req.body;
      const image = req.file;
      let storyData: IStoryRequest = req.body;
      if (!storyData.prompt || !storyData.storyDuration) {
        throw new AppError("Prompt and story duration are required", 400);
      }
      if (image) {
        const imageRes = (await cloudUpload(
          image?.buffer
        )) as UploadApiResponse;
        storyData.image = imageRes.secure_url;
      }
      // const { location, style } = await getStoryGenerationData(
      //   storyData.storyLocationId,
      //   storyData.storyStyleId
      // );

      // const sceneDuration = storyData.storyDuration / 5;
      // const openAIService = new OpenAIService(
      //   sceneDuration,
      //   storyData.storyTitle,
      //   style,
      //   storyData.genere,
      //   location,
      //   storyData.voiceOver ? false : true
      // );
      // const story: IStoryResponse = await openAIService.generateScenes(prompt);

      // const voiceGenerationService = new VoiceGenerationService();
      // const voiceOver = await voiceGenerationService.generateVoiceOver({
      //   voiceGender: storyData.voiceOver?.voiceGender as genderType,
      //   voiceOverLyrics: story.scenes[0].narration as string,
      //   voiceLanguage: storyData.voiceOver?.voiceLanguage as string,
      // });

      // const imageGenerationService = new ImageGenerationService();
      // const resultURL: string =
      //   await imageGenerationService.generateImageFromDescription(
      //     story.scenes[0].imageDescription
      //   );

      // await imageGenerationService.generateImageFromDescription(
      //   story.scenes[0].imageDescription
      // );

      // const videoGenerationService = new VideoGenerationService();

      // const videoURL =
      //   await videoGenerationService.generateVideoFromDescription(
      //     story.scenes[0].videoDescription,
      //     resultURL,
      //     5
      //   );
      // const testDataToSent = {
      //   scene: story.scenes[0],
      //   imageUrl: resultURL,
      //   voiceUrl: voiceOver,
      //   videoUrl: videoURL,
      // };
      res.status(201).json({
        message: "Story Added Successfully",
        data: {
          
        },
      });
    }
  ),

  deleteStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.user!;
      const { storyID } = req.params;

      if (!mongoose.Types.ObjectId.isValid(storyID)) {
        throw new AppError("Invalid story ID", 400);
      }

      const story = await Story.findOneAndDelete({
        _id: storyID,
        userId: id as Types.ObjectId,
      });
      const user = await User.findOneAndUpdate(
        {
          _id: id,
        },
        { $pull: { stories: storyID }, new: true }
      );
      if (!user) {
        throw new AppError("Failed to update user with deleted story", 500);
      }

      if (!story) {
        throw new AppError(
          "Story not found or you do not have permission to delete it",
          404
        );
      }

      res.status(200).json({ message: "Story deleted successfully" });
    }
  ),

  getGenerationData: catchError(async (req: Request, res: Response) => {
    const generationData = await GenerationInfo.findOne().lean();
    res.status(200).json({
      message: "Generation data fetched successfully",
      data: { ...generationData },
    });
  }),

  updateGenerationData: catchError(async (req: Request, res: Response) => {
    const { ...updatingKeys } = req.body;
    const generationData = await GenerationInfo.findOneAndUpdate(
      {},
      { $set: updatingKeys },
      { new: true }
    );
    if (!generationData) {
      throw new AppError("Failed to update generation data", 500);
    }
    res.status(200).json({
      message: "Generation data updated successfully",
      data: generationData,
    });
  }),
};
export default storyController;
