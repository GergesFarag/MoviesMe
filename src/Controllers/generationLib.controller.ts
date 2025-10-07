import { Request, Response, NextFunction } from "express";
import { GenerationLibService } from "../Services/generationLib.service";
import { IGenerationLibRequestDTO } from "../DTOs/generationLib.dto";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import { cloudUpload, generateHashFromBuffer } from "../Utils/APIs/cloudinary";
import { generationLibQueue } from "../Queues/generationLib.queue";
import generationLibSchema from "../Models/generationLib.model";
import { Types, model } from "mongoose";
import { QUEUE_NAMES } from "../Queues/Constants/queueConstants";
import { translationService } from "../Services/translation.service";

const generationLibService = new GenerationLibService();

const generationLibController = {

  createGeneration: catchError(
    async (req: Request, res: Response, next: NextFunction) => {

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
      if(req.body.isVideo && (req.body.isVideo == "false" || !req.body.isVideo)){
        req.body.isVideo = false;
      }else{
        req.body.isVideo = true;
      }
      const requestData: IGenerationLibRequestDTO = req.body;
      
      let uploadedImageUrls: string[] = [];

      const files = req.files as Express.Multer.File[] | undefined;
      
      if (files && files.length > 0) {
        try {
          const uploadPromises = files.map(async (file: Express.Multer.File) => {
            const fileHash = generateHashFromBuffer(file.buffer);
            const publicId = `generation_${userId}_${fileHash}_${Date.now()}`;
            
            const uploadResult = await cloudUpload(
              file.buffer,
              `user_${userId}/generations/input_images`,
              publicId,
              {
                resource_type: "image",
                format: "jpg",
                quality: "auto:good"
              }
            );
            
            return uploadResult.secure_url;
          });

          uploadedImageUrls = await Promise.all(uploadPromises);
          console.log(`Successfully uploaded ${uploadedImageUrls.length} images`);
        } catch (uploadError) {
          console.error("Error uploading images to Cloudinary:", uploadError);
          throw new AppError("Failed to upload images", 500);
        }
      }

      const requestDataWithImages = {
        ...requestData,
        refImages: [...(requestData.refImages || []), ...uploadedImageUrls]
      };

      res.status(201).json({
        success: true,
        message: "Generation task is being processed",
        uploadedImages: uploadedImageUrls.length
      });

      const result = await generationLibService.createGeneration(
        userId,
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
      generationInfo["imageModels"] = translationService.translateGenerationModels(generationInfo["imageModels"], req.headers['accept-language'] as string || 'en');
      generationInfo["videoModels"] = translationService.translateGenerationModels(generationInfo["videoModels"], req.headers['accept-language'] as string || 'en');
      res.status(200).json({
        message: "Generation info retrieved successfully",
        data: generationInfo,
      });
    }
  ),

  updateGenerationInfo: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const updateData = req.body;
      const updatedInfo = await generationLibService.updateGenerationInfo(updateData);
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

    // Find the generation library job
    const generationLibModel = model("GenerationLib", generationLibSchema);
    const jobData = await generationLibModel.findOne({
      _id: jobId,
      status: { $in: ["failed", "error", "cancelled"] },
    });

    if (!jobData) {
      throw new AppError("No failed generation library job found with the provided ID", 404);
    }

    const existingJobId = (jobData._id as Types.ObjectId).toString();

    // Check if a job with this ID is already active in the generation lib queue
    const existingGenJob = await generationLibQueue.getJob(`generation_lib_${existingJobId}`);
    
    if (existingGenJob && !["completed", "failed"].includes(existingGenJob.finishedOn ? "completed" : "failed")) {
      throw new AppError(`Generation library job ${existingJobId} is already being processed`, 409);
    }

    // Create queue job data for generation lib job
    const genLibQueueJobData = {
      generationLibId: existingJobId,
      userId: userId.toString(),
      jobData: jobData,
    };

    try {
      // Add job to generation library queue
      const job = await generationLibQueue.add(QUEUE_NAMES.GENERATION_LIB, genLibQueueJobData, {
        jobId: `generation_lib_${existingJobId}`,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      });

      // Update generation lib status to pending
      await generationLibModel.findByIdAndUpdate(existingJobId, {
        status: "pending",
        updatedAt: new Date(),
      });

      res.status(200).json({
        message: "Generation library job successfully added back to queue",
        data: {
          jobId: job.id,
          generationLibId: existingJobId,
          status: "pending",
          queueType: "generationLib",
        },
      });
    } catch (queueError) {
      console.error("Error adding generation lib job to queue:", queueError);
      throw new AppError("Failed to add generation library job to processing queue", 500);
    }
  }),
};

export default generationLibController;
