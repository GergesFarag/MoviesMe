import { UploadApiResponse } from "cloudinary";
import { cloudUpload } from "../Utils/APIs/cloudinary";
import { taskQueue } from "../Queues/model.queue";
import { filterModelType } from "../Utils/Format/filterModelType";
import { createJobAndUpdateUser } from "../Utils/Database/optimizedOps";
import AppError from "../Utils/Errors/AppError";
import IAiModel from "../Interfaces/aiModel.interface";
import { IUser } from "../Interfaces/user.interface";
import { IItem } from "../Interfaces/item.interface";

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

export const processModelJobAsync = async (
  data: ProcessModelJobData
): Promise<JobResult> => {
  const { user, model, modelId, image, payload, jobId } = data;
  const { ...rest } = payload;
  const userId = (user as any)._id.toString();

  try {
    const imageUrl = (await cloudUpload(image.buffer)) as UploadApiResponse;
    const job = await taskQueue.add(
      {
        modelData: model,
        userId: (user as any)._id,
        data: { image: imageUrl.secure_url, ...rest },
        FCM: "cpywthHXSCiYHZ4Y67K3ts:APA91bGhv_kUbjyPzVBDS5PZXjoJ7Sc3JAd1PZXI7KHRUe6feGMfmaUaWkf1CV662rbZCVR19JptmBzAqSjx83Ujeowidll_Bo_PU5-a1Bmz7YJzVEzgtfE", //! fix it later on
      },
      {
        jobId: jobId,
      }
    );
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
      isFav: false,
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
