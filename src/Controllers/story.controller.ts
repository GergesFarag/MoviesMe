import { NextFunction, Request, Response } from "express";
import catchError from "../Utils/Errors/catchError";
import Story from "../Models/story.model";
import User from "../Models/user.model";
import AppError from "../Utils/Errors/AppError";
import mongoose, { ObjectId, Types } from "mongoose";
import GenerationInfo from "../Models/generationInfo.model";
import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import { cloudUpload } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { VideoGenerationService } from "../Services/videoGeneration.service";
import { ElevenLabsService } from "../Services/elevenLabs.service";

const storyController = {
  getAllStories: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.user!;
      const stories = await Story.where("userId").equals(id);
      if (!stories || stories.length === 0) {
        res
          .status(200)
          .json({ message: "No stories found for this user", data: [] });
      }
      res
        .status(200)
        .json({ message: "Stories Fetched Successfully", data: stories });
    }
  ),

  getStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.user!;
      const { storyID } = req.params;

      res.status(200).json({ story: storyID });
    }
  ),

  generateStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.user!;
      // const image = req.file;
      // let totalData: IStoryRequest = req.body;
      // if (!totalData.prompt || !totalData.storyDuration) {
      //   throw new AppError("Prompt and story duration are required", 400);
      // }
      // if(image){
      //   const imageRes = (await cloudUpload(image?.buffer)) as UploadApiResponse;
      //   totalData.image = imageRes.secure_url;
      // }
      // const v = new VideoGenerationService();
      // const result = await v.generateImageFromDescription(totalData.prompt);
      // console.log("RESULT", result);
      const {prompt} = req.body;
      const imageService = new VideoGenerationService();
      const result = await imageService.generateImageFromDescription(prompt);
      res.status(201).json({ message: "I GOT DATA :", data: result });
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
