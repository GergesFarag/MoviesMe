import User from "../../Models/user.model";
import Job from "../../Models/job.model";
import { IItem } from "../../Interfaces/item.interface";
import GenerationInfo from "../../Models/generationInfo.model";
import { appendFile } from "fs";
import AppError, { HTTP_STATUS_CODE } from "../Errors/AppError";
import { ObjectId } from "mongoose";
import AudioModel from "../../Models/audioModel.model";

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
        items: itemWithTimestamps,
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
): Promise<IItem | null> => {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const item = user.items?.find((item: IItem) => item.jobId === jobId);
  return item || null;
};

export const getVoiceId = async (
  voiceGender: "male" | "female" | "kid"
): Promise<string | null> => {
  const item = await AudioModel.findOne({ gender: voiceGender }).lean();
  if (!item) {
    throw new AppError("No audio model found", HTTP_STATUS_CODE.NOT_FOUND);
  }
  return item.elevenLabsId || null;
};
