import { Types } from "mongoose";
import { jobStatus } from "./job.interface";

export interface IItem {
  _id: Types.ObjectId;
  URL: string;
  modelType?: string;
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  jobId: string;
  status: jobStatus;
  isFav: boolean;
  duration: number;
  createdAt?: Date;
  updatedAt?: Date;
}
