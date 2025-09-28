import { Types } from "mongoose";
import { JobId } from "bull";

export interface IEffectItem {
  _id: Types.ObjectId;
  URL: string;
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  jobId: JobId;
  effectThumbnail: string;
  status: string;
  isFav: boolean;
  duration: number;
  modelType?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
