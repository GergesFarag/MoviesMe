import { Request, Response, NextFunction } from "express";
import { GenerationLibService } from "../Services/generationLib.service";
import { IGenerationLibRequestDTO } from "../DTOs/generationLib.dto";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import { cloudUpload, generateHashFromBuffer } from "../Utils/APIs/cloudinary";
import { generationLibQueue } from "../Queues/generationLib.queue";
import { Types } from "mongoose";
import { translationService } from "../Services/translation.service";
import User from "../Models/user.model";
import { IGenerationLibJobData } from "../Queues/Handlers/generationLibHandlers";
import GenerationInfo from "../Models/generation.model";
import { CreditService } from "../Services/credits.service";
import { NotificationService } from "../Services/notification.service";

const generationLibService = new GenerationLibService();

const generationLibController = {
  createGeneration: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
      if (
        req.body.isVideo &&
        (req.body.isVideo == "false" || !req.body.isVideo)
      ) {
        req.body.isVideo = false;
      } else {
        req.body.isVideo = true;
      }
      if(!req.body.prompt){
        req.body.prompt = "";      }
      const requestData: IGenerationLibRequestDTO = req.body;

      const generationInfo = await GenerationInfo.findOne();
      if (!generationInfo) {
        throw new AppError("No Generation Data Found", 404);
      }
      if (!requestData.isVideo) {
        const model = generationInfo.imageModels.find(
          (m: any) => m._id.toString() === requestData.modelId
        );
        if (!model) {
          throw new AppError("Model not found in imageModels", 404);
        }
        requestData.credits = model.credits;
      } else {
        const model = generationInfo.videoModels.find(
          (m: any) => m._id.toString() === requestData.modelId
        );
        if (!model) {
          throw new AppError("Model not found in videoModels", 404);
        }
        const creditMap = model.credits.find((element: Map<string, number>) => {
          return +element.get("duration")! === +requestData.duration!;
        });
        if (!creditMap) {
          throw new AppError("Invalid duration for the selected model", 400);
        }
        requestData.credits = +creditMap.get("credits")!;
      }
      const creditService = new CreditService();
      const notificationService = new NotificationService();
      const hasSufficientCredits = await creditService.hasSufficientCredits(
        userId,
        requestData.credits
      );
      if (!hasSufficientCredits) {
        throw new AppError("Insufficient credits for this generation", 402);
      }else{
        const deductCredits = await creditService.deductCredits(
          userId,
          Number(requestData.credits)
        );
        if (!deductCredits) {
          console.error(
            `❌ Failed to deduct credits for user ${userId}`
          );
          return;
        }
        const transactionNotificationData = {
          userCredits: await creditService.getCredits(userId),
          consumedCredits: requestData.credits,
        };
        await notificationService.sendTransactionalSocketNotification(
          userId,
          transactionNotificationData
        );
      }

      const jobId = new Types.ObjectId().toString();
      let uploadedImageUrls: string[] = [];

      const files = req.files as Express.Multer.File[] | undefined;

      if (files && files.length > 0) {
        try {
          const uploadPromises = files.map(
            async (file: Express.Multer.File) => {
              const fileHash = generateHashFromBuffer(file.buffer);
              const publicId = `generation_${userId}_${fileHash}_${Date.now()}`;

              const uploadResult = await cloudUpload(
                file.buffer,
                `user_${userId}/generations/input_images`,
                publicId,
                {
                  resource_type: "image",
                  format: "jpg",
                  quality: "auto:good",
                }
              );

              return uploadResult.secure_url;
            }
          );

          uploadedImageUrls = await Promise.all(uploadPromises);
          console.log(
            `Successfully uploaded ${uploadedImageUrls.length} images`
          );
        } catch (uploadError) {
          console.error("Error uploading images to Cloudinary:", uploadError);
          throw new AppError("Failed to upload images", 500);
        }
      }

      const requestDataWithImages = {
        ...requestData,
        refImages: [...(requestData.refImages || []), ...uploadedImageUrls],
      };
      res.status(201).json({
        success: true,
        message: "Generation task is being processed",
        uploadedImages: uploadedImageUrls.length,
        jobId: jobId,
      });

      const result = await generationLibService.createGeneration(
        userId,
        jobId,
        requestDataWithImages
      );
      if (result.success) {
        console.log(`Generation job created with ID: ${result.jobId}`);
      } else {
        console.error(`Failed to create generation job: ${result.message}`);
      }
    }
  ),

  getGenerationInfo: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const generationInfo = await generationLibService.getGenerationInfo();
      if (!generationInfo) {
        throw new AppError("No generation info found", 404);
      }
      generationInfo["imageModels"] =
        translationService.translateGenerationModels(
          generationInfo["imageModels"],
          (req.headers["accept-language"] as string) || "en"
        );
      generationInfo["videoModels"] =
        translationService.translateGenerationModels(
          generationInfo["videoModels"],
          (req.headers["accept-language"] as string) || "en"
        );
      res.status(200).json({
        message: "Generation info retrieved successfully",
        data: generationInfo,
      });
    }
  ),

  updateGenerationInfo: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const updateData = req.body;
      const updatedInfo = await generationLibService.updateGenerationInfo(
        updateData
      );
      res.status(200).json({
        message: "Generation info updated successfully",
        data: updatedInfo,
      });
    }
  ),

  retryGenerationLibJob: catchError(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!jobId) {
      throw new AppError("Job ID is required", 400);
    }

    if (!userId) {
      throw new AppError("User authentication required", 401);
    }

    const user = await User.findById(userId).lean();
    const generationLibItem = user?.generationLib?.find(
      (item) => item.jobId === jobId
    );
    if (!generationLibItem) {
      throw new AppError(
        "No failed generation library job found with the provided ID",
        404
      );
    }

    const existingGenJob = await generationLibQueue.getJob(
      `${generationLibItem.jobId}`
    );
    if (
      existingGenJob &&
      !["completed", "failed"].includes(
        existingGenJob.finishedOn ? "completed" : "failed"
      )
    ) {
      throw new AppError(
        `Generation library job ${generationLibItem.jobId} is already being processed`,
        409
      );
    }

    const genLibQueueJobData: IGenerationLibJobData = {
      jobId: generationLibItem.jobId.toString(),
      userId: userId,
      refImages: generationLibItem.data.refImages,
      isVideo: generationLibItem.isVideo,
      modelId: generationLibItem.data.modelId,
      duration: generationLibItem.duration,
      credits: generationLibItem.data.credits
    };
    if(generationLibItem.data.prompt){
      genLibQueueJobData.prompt = generationLibItem.data.prompt;
    }

    try {
      const job = await generationLibQueue.add(genLibQueueJobData, {
        jobId: generationLibItem.jobId,
        removeOnComplete: true,
        removeOnFail: true,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      });

      res.status(200).json({
        message: "Generation library job successfully added back to queue",
        data: {
          jobId: job.id,
          status: "pending",
          queueType: "generationLib",
        },
      });
    } catch (queueError) {
      console.error("Error adding generation lib job to queue:", queueError);
      throw new AppError(
        "Failed to add generation library job to processing queue",
        500
      );
    }
  }),
};

export default generationLibController;
