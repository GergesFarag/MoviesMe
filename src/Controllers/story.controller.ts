import { NextFunction, Request, Response } from "express";
import catchError from "../Utils/Errors/catchError";
import Story from "../Models/story.model";
import User from "../Models/user.model";
import Job from "../Models/job.model";
import AppError from "../Utils/Errors/AppError";
import mongoose, { Types } from "mongoose";
import GenerationInfo from "../Models/generationInfo.model";
import {
  genderType,
  IStoryRequest,
  IStoryRequestKeys,
} from "../Interfaces/storyRequest.interface";
import { cloudUpload, generateHashFromBuffer } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { VideoGenerationService } from "../Services/videoGeneration.service";
import {
  checkGenereExists,
  createInitialStoryAndUpdateUser,
  getLocationName,
  getStyleName,
} from "../Utils/Database/optimizedOps";
import { processStoryJobAsnc } from "../Services/generateStory.service";
import { generateRandomNumber } from "../Utils/Format/generateRandom";
import storyQueue from "../Queues/story.queue";
import { translationService } from "../Services/translation.service";
import { extractLanguageFromRequest } from "../Utils/Format/languageUtils";
import path from "path";
import { getJsonKey } from "../Utils/Format/json";
const validKeys: IStoryRequestKeys[] = [
  "prompt",
  "storyDuration",
  "voiceOver",
  "storyLocationId",
  "storyStyleId",
  "storyTitle",
  "genere",
  "image",
];

const storyController = {
  generateStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { prompt, storyDuration } = req.body;
      const image = req.file;
      const userId = req.user!.id;
      console.log("Request Body: ", req.body, " and image : ", image);
      Object.keys(req.body).forEach((key) => {
        if (!validKeys.includes(key as IStoryRequestKeys)) {
          throw new AppError(
            `Invalid field: ${key} \n valid fields are: ${validKeys.join(
              ", "
            )}`,
            400
          );
        }
      });
      if (!prompt || !storyDuration) {
        throw new AppError("Prompt and story duration are required", 400);
      }
      let storyData: IStoryRequest = { ...req.body } as IStoryRequest;
      console.log("Story Data: ", storyData);
      const lang = extractLanguageFromRequest(req);
      const translation = require(path.join(
        __dirname,
        `../../locales`,
        `${lang}`,
        "translation.json"
      ));
      if (storyData.genere) {
        const genreValue =
          getJsonKey(translation["genres"], storyData.genere) ||
          storyData.genere;
        if (!(await checkGenereExists(genreValue))) {
          throw new AppError("Invalid genere provided", 400);
        }
        storyData.genere = genreValue;
      }
      console.log("Genre Value", storyData.genere);

      if (storyData.voiceOver && storyData.voiceOver.voiceGender) {
        const genderValue = getJsonKey(
          translation["voiceOver"]["voiceGender"],
          storyData.voiceOver.voiceGender
        );
        storyData.voiceOver.voiceGender = genderValue as genderType;
      }

      const jobId = `${generateRandomNumber()}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 9)}`;

      // Upload image first if provided
      if (image) {
        const imageHash = generateHashFromBuffer(image.buffer);
        const imageRes = (await cloudUpload(
          image?.buffer,
          `user_${userId}/images/uploaded`,
          imageHash
        )) as UploadApiResponse;
        storyData.image = imageRes.secure_url;
      }

      // Resolve location and style names if provided
      let locationName, styleName;
      if (storyData.storyLocationId) {
        locationName = await getLocationName(storyData.storyLocationId);
        if (!locationName) {
          throw new AppError("Invalid location ID provided", 400);
        }
      }

      if (storyData.storyStyleId) {
        styleName = await getStyleName(storyData.storyStyleId);
        if (!styleName) {
          throw new AppError("Invalid style ID provided", 400);
        }
      }

      const createdStory = await createInitialStoryAndUpdateUser(
        userId,
        jobId,
        {
          title:
            storyData.storyTitle ||
            translationService.translateText(
              "notifications.story.pending",
              "title",
              req.headers["accept-language"] || "en"
            ),
          prompt: storyData.prompt,
          genre: storyData.genere || null,
          location: locationName || null,
          style: styleName || null,
          duration: storyData.storyDuration,
          thumbnail: storyData.image,
        }
      );

      res.status(202).json({
        message: "Story created and processing started",
        jobId: jobId,
        storyId: createdStory._id,
        status: "pending",
        data: {
          story: {
            _id: createdStory._id,
            title: createdStory.title,
            status: createdStory.status,
            prompt: createdStory.prompt,
            duration: createdStory.duration,
            genre: createdStory.genre,
            location: createdStory.location,
            style: createdStory.style,
            jobId: createdStory.jobId,
            createdAt: createdStory.createdAt,
          },
        },
      });

      try {
        await processStoryJobAsnc(storyData, userId, jobId);
      } catch (error) {
        // await Story.findByIdAndUpdate(createdStory._id, { status: "failed" });
        throw new AppError("Failed to process story generation", 500);
      }
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
    if (!generationData) {
      throw new AppError("Generation data not found", 404);
    }
    const translatedGenerationData = translationService.translateGenerationData(
      generationData,
      req.headers["accept-language"] || "en"
    );
    res.status(200).json({
      message: "Generation data fetched successfully",
      data: { ...translatedGenerationData },
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
