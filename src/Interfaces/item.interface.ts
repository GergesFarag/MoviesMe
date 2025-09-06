import { Types } from "mongoose";
import { JobId } from "bull";

export interface IItem {
  _id: Types.ObjectId;
  URL: string;
  modelType?: string;
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  jobId: JobId;
  status: string;
  isFav: boolean;
  duration: number;
  createdAt?: Date;
  updatedAt?: Date;
}