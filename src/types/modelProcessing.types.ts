/**
 * Enhanced type definitions for model processing and queries
 */

import { Types } from "mongoose";
import { IUser } from "../Interfaces/user.interface";
import IAiModel from "../Interfaces/aiModel.interface";
import { JobStatus, ModelFilterType } from "../Constants/modelConstants";

/**
 * User interface with properly typed MongoDB _id
 */
export interface UserWithId extends IUser {
  _id: Types.ObjectId;
}

/**
 * Configuration for querying models with pagination and filters
 */
export interface ModelQueryConfig {
  filterType: ModelFilterType;
  limit?: number;
  page?: number;
  sortBy?: string;
  category?: string;
  locale: string;
}

/**
 * Result from image upload operations
 */
export interface ImageUploadResult {
  url: string;
  secure_url: string;
  public_id?: string;
}

/**
 * Options for processing model jobs
 */
export interface ProcessJobOptions {
  isMultiImage: boolean;
  persistJob: boolean;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

/**
 * Payload for model processing - can be extended based on specific model needs
 */
export interface ModelProcessPayload {
  [key: string]: any;
}

/**
 * Common data required for processing any model job
 */
export interface BaseProcessModelData {
  user: UserWithId;
  model: IAiModel;
  modelId: string;
  payload: ModelProcessPayload;
  jobId: string;
}

/**
 * Data for processing single image model jobs
 */
export interface ProcessSingleImageJobData extends BaseProcessModelData {
  image: Express.Multer.File;
}

/**
 * Data for processing multi-image model jobs
 */
export interface ProcessMultiImageJobData extends BaseProcessModelData {
  images: Express.Multer.File[];
}

/**
 * Union type for all model processing data
 */
export type ProcessModelJobData = ProcessSingleImageJobData | ProcessMultiImageJobData;

/**
 * Result from job processing operations
 */
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

/**
 * Item data for effect library
 */
export interface EffectItemData {
  URL: string;
  modelType: string;
  jobId: string;
  status: JobStatus;
  previewURL?: string;
  isFav: boolean;
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  duration: number;
}