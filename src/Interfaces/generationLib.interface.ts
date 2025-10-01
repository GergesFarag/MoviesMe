import { Types } from "mongoose";
import { JobId } from "bull";

export interface IGenerationLib {
  _id: Types.ObjectId;
  URL: string|null;
  isVideo: boolean;
  jobId: JobId;
  thumbnail: string|null;
  status: string;
  isFav: boolean;
  duration: number;
  modelId?:string;
  createdAt?: Date;
  updatedAt?: Date;
}