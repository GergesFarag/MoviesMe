import { UploadApiResponse } from 'cloudinary';
import { cloudUpload, generateHashFromBuffer } from '../Utils/APIs/cloudinary';
import { taskQueue } from '../Queues/model.queue';
import {
  filterModelType,
  modelTypeMapper,
} from '../Utils/Format/filterModelType';
import { RepositoryOrchestrationService } from '../Services/repositoryOrchestration.service';
import AppError from '../Utils/Errors/AppError';
import IAiModel from '../Interfaces/aiModel.interface';
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
} from '../types/modelProcessing.types';
import {
  UPLOAD_PATHS,
  JOB_STATUS,
  MODEL_TYPE,
} from '../Constants/modelConstants';

const uploadImages = async (
  images: Express.Multer.File[],
  userId: string
): Promise<string[]> => {
  const imageUrls: string[] = [];

  for (const image of images) {
    if (!image || !image.buffer) {
      throw new AppError('Invalid image file', 400);
    }

    const imageHash = generateHashFromBuffer(image.buffer);
    const uploadResult = (await cloudUpload(
      image.buffer,
      UPLOAD_PATHS.USER_IMAGES(userId),
      imageHash
    )) as UploadApiResponse;

    if (!uploadResult || !uploadResult.secure_url) {
      throw new AppError('Image upload failed', 500);
    }

    imageUrls.push(uploadResult.secure_url);
  }

  return imageUrls;
};

export const createQueueJobData = (
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
  data: ProcessSingleImageJobData | ProcessMultiImageJobData
): Promise<JobResult> => {
  const { user, model, modelId, payload, jobId } = data;
  const { ...rest } = payload;
  const userId = user._id.toString();

  const images = 'images' in data ? data.images : [data.image];
  const isSingleImage = 'image' in data;

  try {
    const imageUrls = await uploadImages(images, userId);

    const queueJobData = createQueueJobData(
      model,
      userId,
      isSingleImage
        ? { image: imageUrls[0], ...rest }
        : { images: imageUrls, ...rest },
      user.FCMToken || undefined
    );

    const jobOptions = { jobId, removeOnComplete: true, removeOnFail: true };

    const job = await taskQueue.add(queueJobData, jobOptions);

    if (!job || !job.id) {
      throw new AppError('Job creation failed', 500);
    }

    const modelType = filterModelType(model);
    const itemData: EffectItemData = {
      URL: imageUrls[0],
      modelType: modelType,
      jobId: job.id.toString(),
      status: JOB_STATUS.PENDING,
      previewURL: imageUrls[0],
      isFav: false,
      data: {
        modelId: modelId,
        images: imageUrls,
      },
      modelName: model.name,
      isVideo: model.isVideo,
      modelThumbnail: model.thumbnail,
      duration: 0,
    };

    const orchestrationService = RepositoryOrchestrationService.getInstance();
    await orchestrationService.createJobAndUpdateUser(
      userId,
      {
        jobId,
        userId,
        modelId,
        status: JOB_STATUS.PENDING,
      },
      itemData
    );

    return {
      success: true,
      jobId: job.id.toString(),
    };
  } catch (error) {
    console.error('Error in processModelJobAsync:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};
