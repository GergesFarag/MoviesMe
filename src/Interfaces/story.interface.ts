import mongoose, { Document } from "mongoose";
import { IScene } from "./scene.interface";
import { jobStatus } from "./job.interface";
export interface IStory extends Document {
  title: string;
  prompt: string;
  status: jobStatus;
  thumbnail: string;
  isFav: boolean;
  videoUrl: string;
  duration: number;
  style: string;
  location: string;
  genre: string;
  scenes: IScene[];
  jobId: string;
  voiceOver?: {
    voiceOverLyrics: string | null;
    voiceGender: string | null;
    voiceLanguage: string | null;
    sound: string | null;
    text: string | null;
  };
  userId: mongoose.Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface StoryProcessingResult {
  finalVideoUrl: string;
  story: IStory;
}