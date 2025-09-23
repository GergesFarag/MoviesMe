import User from "../../Models/user.model";
import Job from "../../Models/job.model";
import Story from "../../Models/story.model";
import { IEffectItem } from "../../Interfaces/effectItem.interface";
import { IStory } from "../../Interfaces/story.interface";
import GenerationInfo from "../../Models/generationInfo.model";
import { appendFile } from "fs";
import AppError, { HTTP_STATUS_CODE } from "../Errors/AppError";
import { ObjectId } from "mongoose";
import mongoose from "mongoose";
import AudioModel from "../../Models/audioModel.model";
import Model from "../../Models/aiModel.model";

export interface JobCreationData {
  jobId: string;
  userId: string;
  modelId: string;
  status: string;
}

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

export const createJobAndUpdateUser = async (
  userId: string,
  jobData: JobCreationData,
  itemData: ItemData
) => {
  const [createdJob] = await Promise.all([Job.create(jobData)]);

  const itemWithTimestamps = {
    ...itemData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await User.findByIdAndUpdate(
    userId,
    {
      $push: {
        effectsLib: itemWithTimestamps,
        jobs: { _id: createdJob._id, jobId: createdJob.jobId },
      },
    },
    {
      new: false,
      writeConcern: { w: 1 },
    }
  );

  return createdJob;
};

export const getItemFromUser = async (
  userId: string,
  jobId: string
): Promise<IEffectItem | null> => {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const item = user.effectsLib?.find((item: IEffectItem) => item.jobId === jobId);
  return item || null;
};

export const getVoiceName = async (
  voiceGender: "male" | "female" | "kid"
): Promise<string | null> => {
  const item = await AudioModel.findOne({ gender: voiceGender }).lean();
  if (!item) {
    throw new AppError("No audio model found", HTTP_STATUS_CODE.NOT_FOUND);
  }
  return item.name || null;
};

export const getVoiceELIds = async (voiceGender:string , voiceLanguage:string): Promise<string> => {
  const item = await AudioModel.findOne({ gender: voiceGender, language: voiceLanguage }).lean();
  if (!item) {
    return 'UR972wNGq3zluze0LoIp'
  }
  return item.elevenLabsId.toString();
}

export const getModelCallApi = async (modelId: string): Promise<string|null> => {
  const model = await Model.findById(modelId).lean();
  if (!model) {
    throw new AppError("No audio model found", HTTP_STATUS_CODE.NOT_FOUND);
  }
  return model.wavespeedCall || null;
};

export const getLocationName = async (locationId?: string): Promise<string | undefined> => {
  if (!locationId) return undefined;
  const generationData = await GenerationInfo.findOne().lean();
  return generationData?.location.find((loc: any) => 
    loc._id?.toString() === locationId
  )?.name;
};

export const getStyleName = async (styleId?: string): Promise<string | undefined> => {
  if (!styleId) return undefined;
  const generationData = await GenerationInfo.findOne().lean();
  return generationData?.style.find((sty: any) => 
    sty._id?.toString() === styleId
  )?.name;
};

export const checkGenereExists = async (genere: string): Promise<boolean> => {
  const generationData = await GenerationInfo.findOne().lean();
  return generationData?.genres.includes(genere.toLowerCase()) || false;
};

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

export const createStoryAndUpdateUser = async (
  storyData: StoryCreationData
): Promise<IStory> => {
  // Create the story
  const createdStory = await Story.create({
    ...storyData,
    status: "completed",
    isFav: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update user's storiesLib and jobs status
  const user = await User.findByIdAndUpdate(
    storyData.userId,
    {
      $push: {
        storiesLib: createdStory._id,
      },
    },
    {
      new: false,
      writeConcern: { w: 1 },
    }
  );

  if (!user) {
    throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
  }

  // Update job status to completed
  await Job.findOneAndUpdate(
    { jobId: storyData.jobId },
    { 
      status: "completed",
      updatedAt: new Date()
    }
  );

  return createdStory;
};

export const createInitialStoryAndUpdateUser = async (
  userId: string,
  jobId: string,
  storyData: {
    title: string;
    prompt: string;
    genre?: string | null;
    location?: string | null;
    style?: string | null;
    duration: number;
    thumbnail?: string;
  }
): Promise<IStory> => {
  // Create the story with pending status and basic data
  // Set all non-completed fields to null until they have actual values
  const createdStory = await Story.create({
    userId,
    jobId,
    title: storyData.title || "Generating...",
    prompt: storyData.prompt,
    status: "pending",
    isFav: false,
    videoUrl: null, // Will be set when video generation completes
    duration: storyData.duration,
    genre: storyData.genre || null,
    location: storyData.location || null,
    style: storyData.style || null,
    thumbnail: storyData.thumbnail || null, // Will be set when image generation completes
    scenes: [], // Will be populated when job completes
    voiceOver: null, // Will be set only if voice over is requested and completed
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("USER ID" , userId);
  // Update user's storiesLib immediately
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $push: {
        storiesLib: createdStory._id,
      },
    },
    {
      new: false,
      writeConcern: { w: 1 },
    }
  );

  if (!user) {
    // If user update fails, remove the created story
    await Story.findByIdAndDelete(createdStory._id);
    throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
  }

  return createdStory;
};

export const updateCompletedStory = async (
  jobId: string,
  updateData: {
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
  }
): Promise<IStory | null> => {
  try {
    // Validate required fields
    if (!jobId) {
      throw new AppError("Job ID is required for story update", HTTP_STATUS_CODE.BAD_REQUEST);
    }
    
    // Note: videoUrl is now optional (null means video generation was disabled)
    console.log(`Updating story for jobId: ${jobId}`);
    console.log("Update data:", updateData);

    // Check if story exists first (don't restrict by status to handle race conditions)
    const existingStory = await Story.findOne({ jobId });
    if (!existingStory) {
      console.error(`Story not found for jobId: ${jobId}`);
      throw new AppError("Story not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // If story is already completed, log and return it without error
    if (existingStory.status === "completed") {
      console.log(`Story with jobId: ${jobId} is already completed. Returning existing story.`);
      
      // Also ensure the job status is updated to completed if it's not already
      await Job.findOneAndUpdate(
        { jobId },
        { 
          status: "completed",
          updatedAt: new Date()
        },
        { new: true }
      );
      
      return existingStory;
    }

    // If story is failed, we can still update it to completed
    if (existingStory.status === "failed") {
      console.log(`Story with jobId: ${jobId} was marked as failed, but updating to completed.`);
    }

    // Update the existing story with completed data (allow updating from any status)
    // Only set fields that have actual values, keeping null for incomplete fields
    const updateFields: any = {
      status: "completed",
      updatedAt: new Date(),
    };

    // Set fields even if they are null (to explicitly mark as no video/thumbnail when generation is disabled)
    updateFields.videoUrl = updateData.videoUrl; // Can be null when video generation is disabled
    
    if (updateData.scenes && updateData.scenes.length > 0) {
      updateFields.scenes = updateData.scenes;
    }
    
    updateFields.thumbnail = updateData.thumbnail; // Can be null when image generation is disabled
    
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
    
    if (updateData.voiceOver && updateData.voiceOver.sound && updateData.voiceOver.text) {
      updateFields.voiceOver = updateData.voiceOver;
    }

    const updatedStory = await Story.findOneAndUpdate(
      { jobId },
      updateFields,
      { new: true }
    );

    if (!updatedStory) {
      throw new AppError("Failed to update story", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
    }

    console.log(`Story updated successfully: ${updatedStory._id}`);

    // Update job status to completed
    const jobUpdate = await Job.findOneAndUpdate(
      { jobId },
      { 
        status: "completed",
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!jobUpdate) {
      console.warn(`Job not found for jobId: ${jobId}, but story was updated successfully`);
    } else {
      console.log(`Job updated successfully: ${jobUpdate._id}`);
    }

    return updatedStory;
  } catch (error) {
    console.error("Error in updateCompletedStory:", error);
    throw error;
  }
};

export const createJobForStory = async (
  userId: string,
  jobId: string,
  modelId?: string
): Promise<void> => {
  try {
    console.log(`Creating job for story - userId: ${userId}, jobId: ${jobId}`);
    
    // Use a valid ObjectId for modelId - create a default one if not provided
    const defaultModelId = new mongoose.Types.ObjectId();
    
    const createdJob = await Job.create({
      jobId,
      userId,
      modelId: modelId ? new mongoose.Types.ObjectId(modelId) : defaultModelId,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`Job created successfully: ${createdJob._id}`);

    // Add job to user's jobs array
    const userUpdate = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          jobs: { _id: createdJob._id, jobId: createdJob.jobId },
        },
      },
      {
        new: false,
        writeConcern: { w: 1 },
      }
    );

    if (!userUpdate) {
      console.error(`Failed to update user jobs for userId: ${userId}`);
      // Clean up the created job if user update fails
      await Job.findByIdAndDelete(createdJob._id);
      throw new AppError("Failed to update user with job", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
    }

    console.log(`User jobs updated successfully for userId: ${userId}`);
  } catch (error) {
    console.error("Error in createJobForStory:", error);
    throw error;
  }
};