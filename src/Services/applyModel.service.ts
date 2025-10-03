import { UploadApiResponse } from "cloudinary";
import { cloudUpload, generateHashFromBuffer } from "../Utils/APIs/cloudinary";
import { taskQueue } from "../Queues/model.queue";
import {
  filterModelType,
  modelTypeMapper,
} from "../Utils/Format/filterModelType";
import { createJobAndUpdateUser } from "../Utils/Database/optimizedOps";
import AppError from "../Utils/Errors/AppError";
import IAiModel from "../Interfaces/aiModel.interface";
import {
  UserWithId,
  ProcessSingleImageJobData,
  ProcessMultiImageJobData,
  JobResult,
  ImageUploadResult,
  QueueJobData,
  QueueJobOptions,
  ProcessJobOptions,
  EffectItemData,
} from "../types/modelProcessing.types";
import {
  UPLOAD_PATHS,
  JOB_STATUS,
  MODEL_TYPE,
} from "../Constants/modelConstants";

/**
 * Upload a single or multiple images to Cloudinary
 * @param images - Array of image files to upload
 * @param userId - User ID for organizing uploads
 * @returns Array of secure URLs for uploaded images
 */
const uploadImages = async (
  images: Express.Multer.File[],
  userId: string
): Promise<string[]> => {
  const imageUrls: string[] = [];

  for (const image of images) {
    if (!image || !image.buffer) {
      throw new AppError("Invalid image file", 400);
    }

    const imageHash = generateHashFromBuffer(image.buffer);
    const uploadResult = (await cloudUpload(
      image.buffer,
      UPLOAD_PATHS.USER_IMAGES(userId),
      imageHash
    )) as UploadApiResponse;

    if (!uploadResult || !uploadResult.secure_url) {
      throw new AppError("Image upload failed", 500);
    }

    imageUrls.push(uploadResult.secure_url);
  }

  return imageUrls;
};

const createQueueJobData = (
  model: IAiModel,
  userId: string,
  data: Record<string, any>,
  FCMToken?: string
): QueueJobData => ({
  modelData: model,
  userId: userId as any,
  data,
  FCM: FCMToken,
  prompt: model.prompt || undefined,
});

export const processModelJobAsync = async (
  data: ProcessSingleImageJobData
): Promise<JobResult> => {
  const { user, model, modelId, image, payload, jobId } = data;
  const { ...rest } = payload;
  const userId = user._id.toString();

  try {
    const [imageUrl] = await uploadImages([image], userId);

    const queueJobData = createQueueJobData(
      model,
      user._id.toString(),
      { image: imageUrl, ...rest },
      user.FCMToken || undefined
    );

    const job = await taskQueue.add(queueJobData, { jobId });

    if (!job || !job.id) {
      throw new AppError("Job creation failed", 500);
    }

    const modelType = filterModelType(model);
    const finalModelType =
      modelType === MODEL_TYPE.BYTEDANCE ? MODEL_TYPE.IMAGE_EFFECTS : modelType;

    const itemData: EffectItemData = {
      URL: imageUrl,
      modelType: finalModelType,
      jobId: job.id.toString(),
      status: JOB_STATUS.PENDING,
      previewURL: imageUrl,
      isFav: false,
      modelName: model.name,
      isVideo: model.isVideo,
      modelThumbnail: model.thumbnail,
      duration: 0,
    };

    const createdJob = await createJobAndUpdateUser(
      userId,
      {
        jobId,
        userId,
        modelId,
        status: JOB_STATUS.PENDING,
      },
      itemData
    );

    console.log("Data set successfully!!", createdJob);

    return {
      success: true,
      jobId: job.id.toString(),
    };
  } catch (error) {
    console.error("Error in processModelJobAsync:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

export const processMultiImageJobAsync = async (
  data: ProcessMultiImageJobData
): Promise<JobResult> => {
  const { user, model, images, payload, jobId } = data;
  const { ...rest } = payload;
  const userId = user._id.toString();

  try {
    const imageUrls = await uploadImages(images, userId);

    const queueJobData = createQueueJobData(
      model,
      user._id.toString(),
      { images: imageUrls, ...rest },
      user.FCMToken || undefined
    );

    const job = await taskQueue.add(queueJobData, {
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    });

    if (!job || !job.id) {
      throw new AppError("Job creation failed", 500);
    }

    return {
      success: true,
      jobId: job.id.toString(),
    };
  } catch (error) {
    console.error("Error in processMultiImageJobAsync:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
