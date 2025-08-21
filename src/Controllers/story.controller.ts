import { NextFunction, Request, Response } from "express";
import catchError from "../Utils/Errors/catchError";
import Story from "../Models/story.model";
import User from "../Models/user.model";
import { openAICalling } from "../Utils/openAI_calling";
import AppError from "../Utils/Errors/AppError";
import mongoose, { Types } from "mongoose";
import { IScene } from "../Interfaces/scene.interface";
import GenerationInfo from "../Models/generationInfo.model";

const storyController = {
  getAllStories: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      //@ts-ignore
      const { id } = req.user;
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
      //@ts-ignore
      const { id } = req.user;
      const { storyID } = req.params;

      res.status(200).json({ story: storyID });
    }
  ),

  addStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      //@ts-ignore
      const { id } = req.user;
      const { prompt } = req.body;
      if (!prompt) {
        throw new AppError("Prompt is required", 400);
      }
      const response = await openAICalling(prompt);
      console.log("response : ", response);
      if (!response) {
        throw new AppError("Failed to generate story", 500);
      }

      const story = await Story.create({
        title: response.title,
        userId: id as Types.ObjectId,
        scenes: response.scenes.map((scene: IScene) => ({
          sceneNumber: scene.sceneNumber,
          videoDescription: scene.videoDescription,
          imageDescription: scene.imageDescription,
        })),
      });
      if (!story) {
        throw new AppError("Failed to create story", 500);
      }
      const user = await User.findByIdAndUpdate(id, {
        $push: { stories: story._id },
      });

      if (!user) {
        throw new AppError("Failed to update user with new story", 500);
      }
      res.status(201).json({
        message: "Story Added Successfully",
        data: { story },
      });
    }
  ),

  deleteStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      //@ts-ignore
      const { id } = req.user;
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
    const generationData = await GenerationInfo.findOne();
    console.log("Generation Data Got : ", generationData);
    res.status(200).json({
      message: "Generation data fetched successfully",
      data: {...generationData},
    });
  }),

  updateGenerationData: catchError(async (req:Request , res:Response) => {
  const {...updatingKeys} = req.body;
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
  })
};
export default storyController;
