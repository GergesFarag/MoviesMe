import { UploadApiResponse } from "cloudinary";
import { cloudUpload } from "../Utils/APIs/cloudinary";
import { taskQueue } from "../Queues/model.queue";
import { filterModelType } from "../Utils/Format/filterModelType";
import { createJobAndUpdateUser } from "../Utils/Database/optimizedOps";
import AppError from "../Utils/Errors/AppError";
import IAiModel from "../Interfaces/aiModel.interface";
import { IUser } from "../Interfaces/user.interface";

interface ProcessModelJobData {
  user: IUser;
  model: IAiModel;
  modelId: string;
  image: Express.Multer.File;
  payload: any;
  jobId: string;
}

interface JobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export const processModelJobAsync = async (data: ProcessModelJobData): Promise<JobResult> => {
  const { user, model, modelId, image, payload, jobId } = data;
  const { ...rest } = payload;
  const userId = (user as any)._id.toString();

  try {
    const [imageUrl, job] = await Promise.all([
      cloudUpload(image.buffer) as Promise<UploadApiResponse>,
      taskQueue.add({
        modelData: model,
        userId: (user as any)._id,
        data: { imageBuffer: image.buffer, ...rest },
        FCM: user.FCMToken,
      }, {
        jobId: jobId,
      })
    ]);

    if (!imageUrl || !imageUrl.url) {

      if (job) await job.remove();
      
      throw new AppError("Image upload failed", 500);
    }

    if (!job || !job.id) {
      throw new AppError("Job creation failed", 500);
    }

    const modelType = filterModelType(model);
    const itemData = {
      URL: imageUrl.url,
      modelType: modelType,
      jobId: job.id.toString(),
      status: "pending",
      modelName: model.name,
      isVideo: model.isVideo,
      modelThumbnail: model.thumbnail,
      duration: 0,
    };

    await createJobAndUpdateUser(
      userId,
      {
        jobId: jobId,
        userId: userId,
        modelId: modelId,
        status: "pending",
      },
      itemData
    );

    await job.update({
      ...job.data,
      data: { image: imageUrl.url, ...rest }
    });
    return {
      success: true,
      jobId: job.id.toString()
    };

  } catch (error) {
    console.error('Error in processModelJobAsync:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};
