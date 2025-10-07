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
  userId: mongoose.Schema.Types.ObjectId;
  refImage?: string;
  voiceOver?: {
    voiceOverLyrics: string | null;
    voiceGender: string | null;
    voiceLanguage: string | null;
    voiceAccent: string | null;
    sound: string | null;
    text: string | null;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
export interface StoryProcessingResult {
  finalVideoUrl: string;
  story: IStory;
}