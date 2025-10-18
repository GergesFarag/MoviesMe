import { NextFunction, Request, Response } from "express";
import catchError from "../Utils/Errors/catchError";
import Story from "../Models/story.model";
import User from "../Models/user.model";
import Job from "../Models/job.model";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import mongoose, { Types } from "mongoose";
import StoryGenerationInfo from "../Models/storyGenerationInfo.model";
import {
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
import { QUEUE_NAMES } from "../Queues/Constants/queueConstants";
import { StoryProcessingDTO } from "../DTOs/storyRequest.dto";
import { CreditService } from "../Services/credits.service";
import { NotificationService } from "../Services/notification.service";
const validKeys: IStoryRequestKeys[] = [
  "prompt",
  "storyDuration",
  "voiceOver",
  "storyLocationId",
  "storyStyleId",
  "storyTitle",
  "genere",
  "image",
  "credits",
];

const storyController = {
  generateStory: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { prompt, storyDuration } = req.body;
      console.log("BODY", req.body);
      const userId = req.user!.id;
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
      const credits = Number(req.body.credits);
      if (!credits) {
        throw new AppError("Credits field is required", 400);
      }
      const creditService = new CreditService();
      const notificationService = new NotificationService();
      const hasVoiceOver: boolean = req.body.voiceOver || req.body.audio;
      const calculatedCredits = await creditService.getStoryCredits(
        storyDuration / 5,
        hasVoiceOver
      );
      const verifyCorrectCredits = creditService.isValidCredits(credits,calculatedCredits);
      console.log(verifyCorrectCredits);
      if (!verifyCorrectCredits) {
        console.log("GONE IN ERROR");
        throw new AppError(
          `Incorrect credits provided. Required credits for the story is ${calculatedCredits}`,
          400
        );
      }
      const hasSufficientCredits = await creditService.hasSufficientCredits(
        req.user!.id,
        +credits
      );
      if (!hasSufficientCredits) {
        throw new AppError(
          "Insufficient credits to create story",
          HTTP_STATUS_CODE.PAYMENT_REQUIRED
        );
      } else {
        const deductCredits = await creditService.deductCredits(
          userId,
          Number(credits)
        );
        if (!deductCredits) {
          console.error(`❌ Failed to deduct credits for user ${userId}`);
          return;
        }
        const transactionNotificationData = {
          userCredits: await creditService.getCredits(userId),
          consumedCredits: credits,
        };
        await notificationService.sendTransactionalSocketNotification(
          userId,
          transactionNotificationData
        );
      }
      const image =
        req.files && "image" in req.files
          ? (req.files["image"] as Express.Multer.File[])[0]
          : null;
      const audio =
        req.files && "audio" in req.files
          ? (req.files["audio"] as Express.Multer.File[])[0]
          : null;
      console.log("Request Body: ", req.body, " and image : ", image);
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
      if (audio) {
        const audioHash = generateHashFromBuffer(audio.buffer);
        const audioRes = (await cloudUpload(
          audio?.buffer,
          `user_${userId}/audio/uploaded`,
          audioHash
        )) as UploadApiResponse;
        storyData.audio = audioRes.secure_url;
      }
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
          refImage: storyData.image || null,
          duration: storyData.storyDuration,
          thumbnail: storyData.image,
          credits: storyData.credits,
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
    const generationData = await StoryGenerationInfo.findOne().lean();
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

  retryFailedJob: catchError(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const userId = req.user?.id;
    if (!jobId) {
      throw new AppError("Job ID is required", 400);
    }

    if (!userId) {
      throw new AppError("User authentication required", 401);
    }

    // Find the job in the database
    const job = await Job.findOne({ jobId: jobId });

    console.log("USER ID : ", userId, "JOB USER ID", job?.userId);
    if (!job) {
      throw new AppError("Job not found", 404);
    }

    // Verify that the job belongs to the authenticated user
    if (job.userId.toString() !== String(userId)) {
      throw new AppError("Unauthorized to retry this job", 403);
    }

    // Check if job is actually failed
    if (job.status !== "failed") {
      throw new AppError(
        `Job is currently ${job.status}. Only failed jobs can be retried`,
        400
      );
    }

    try {
      const story = await Story.findOne({ jobId });
      if (!story) {
        throw new AppError("Story associated with this job not found", 404);
      }
      const storyRequest: IStoryRequest = {
        prompt: story.prompt,
        storyDuration: story.duration,
        voiceOver: story.voiceOver
          ? {
              voiceOverLyrics: story.voiceOver.voiceOverLyrics,
              voiceLanguage: story.voiceOver.voiceLanguage,
              voiceGender: story.voiceOver.voiceGender || "male",
              voiceAccent: story.voiceOver.voiceAccent,
              sound: story.voiceOver.sound,
              text: story.voiceOver.text,
            }
          : undefined,
        storyTitle: story.title,
        genere: story.genre,
        image: story.refImage,
        audio: story.voiceOver?.sound || undefined,
        credits: story.credits,
      };
      const processingStory = new StoryProcessingDTO(storyRequest).toDTO(
        story.style || null,
        story.location || null
      );

      console.log("📋 Processing story data for retry:", {
        jobId,
        userId,
        storyData: processingStory,
      });

      await Job.findOneAndUpdate(
        { jobId },
        {
          status: "pending",
          updatedAt: new Date(),
        }
      );

      await Story.findOneAndUpdate(
        { jobId },
        {
          status: "pending",
          updatedAt: new Date(),
        }
      );

      const newJob = await storyQueue.add(
        {
          ...processingStory,
          userId,
          jobId,
        },
        {
          jobId: jobId,
        }
      );

      res.status(200).json({
        message: "Job successfully added back to queue",
        data: {
          jobId,
          status: "pending",
          retryTimestamp: new Date(),
          jobData: newJob.data,
        },
      });
    } catch (error: any) {
      console.error(`❌ Error retrying job ${jobId}:`, error);
      if (
        error?.message?.includes("Queue") ||
        error?.message?.includes("Redis")
      ) {
        throw new AppError(
          "Queue service is currently unavailable. Please try again later.",
          503
        );
      }

      throw new AppError(
        error?.message || "Failed to retry job. Please try again later.",
        500
      );
    }
  }),

  updateGenerationData: catchError(async (req: Request, res: Response) => {
    const { ...updatingKeys } = req.body;
    const generationData = await StoryGenerationInfo.findOneAndUpdate(
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
