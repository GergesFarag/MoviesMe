import { Types } from "mongoose";
import { IUser } from "../Interfaces/user.interface";
import IAiModel from "../Interfaces/aiModel.interface";
import { JobStatus, ModelFilterType } from "../Constants/modelConstants";
import { IEffectItemRequest } from "../Interfaces/effectItem.interface";

export interface UserWithId extends IUser {
  _id: Types.ObjectId;
}


export interface ModelQueryConfig {
  filterType: ModelFilterType;
  limit?: number;
  page?: number;
  sortBy?: string;
  category?: string;
  locale: string;
}

export interface ImageUploadResult {
  url: string;
  secure_url: string;
  public_id?: string;
}

export interface ProcessJobOptions {
  isMultiImage: boolean;
  persistJob: boolean;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface ModelProcessPayload {
  [key: string]: any;
}


export interface BaseProcessModelData {
  user: UserWithId;
  model: IAiModel;
  modelId: string;
  payload: ModelProcessPayload;
  jobId: string;
}

export interface ProcessSingleImageJobData extends BaseProcessModelData {
  image: Express.Multer.File;
}

export interface ProcessMultiImageJobData extends BaseProcessModelData {
  images: Express.Multer.File[];
}

export type ProcessModelJobData = ProcessSingleImageJobData | ProcessMultiImageJobData;

export interface JobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}


export interface QueueJobData {
  modelData: IAiModel;
  userId: Types.ObjectId;
  data: {
    image?: string;
    images?: string[];
    [key: string]: any;
  };
  FCM?: string;
  prompt?: string;
}

export interface QueueJobOptions {
  jobId: string;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface ModelFetchResult {
  items: IAiModel[];
  paginationData: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface EffectItemData {
  URL: string;
  modelType: string;
  jobId: string;
  status: JobStatus;
  isFav: boolean;
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  data: IEffectItemRequest;
  duration: number;
  previewURL?: string;
}