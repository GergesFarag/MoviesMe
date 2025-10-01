import { Request, Response, NextFunction } from "express";
import { GenerationLibService } from "../Services/generationLib.service";
import { IGenerationLibRequestDTO } from "../DTOs/generationLib.dto";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import { cloudUpload, generateHashFromBuffer } from "../Utils/APIs/cloudinary";

const generationLibService = new GenerationLibService();

const generationLibController = {
  createGeneration: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      console.log("Request body:", req.body);
      console.log("Request files:", req.files);
      console.log("Content-Type:", req.get('Content-Type'));
      
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const requestData: IGenerationLibRequestDTO = req.body;

      if (!requestData.prompt) {
        throw new AppError("Prompt is required", 400);
      }

      let uploadedImageUrls: string[] = [];

      const files = req.files as Express.Multer.File[] | undefined;
      
      if (files && files.length > 0) {
        console.log(`Uploading ${files.length} images to Cloudinary...`);
        console.log(`Field names received:`, files.map(f => f.fieldname));
        
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

  getUserGenerations: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
      const generations = await generationLibService.getUserGenerations(userId);

      res.status(200).json({
        success: true,
        message: "Generations retrieved successfully",
        data: generations,
      });
    }
  ),

  getGenerationById: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
      const { id } = req.params;
      if (!id) {
        throw new AppError("Generation ID is required", 400);
      }

      const generation = await generationLibService.getGenerationById(
        userId,
        id
      );

      res.status(200).json({
        success: true,
        message: "Generation retrieved successfully",
        data: generation,
      });
    }
  ),

  updateFavoriteStatus: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
      const { id } = req.params;
      const { isFavorite } = req.body;

      if (!id) {
        throw new AppError("Generation ID is required", 400);
      }

      if (typeof isFavorite !== "boolean") {
        throw new AppError("isFavorite must be a boolean value", 400);
      }

      const updatedGeneration = await generationLibService.updateFavoriteStatus(
        userId,
        id,
        isFavorite
      );

      res.status(200).json({
        success: true,
        message: "Favorite status updated successfully",
        data: updatedGeneration,
      });
    }
  ),

  deleteGeneration: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
      const { id } = req.params;
      if (!id) {
        throw new AppError("Generation ID is required", 400);
      }

      await generationLibService.deleteGeneration(userId, id);

      res.status(200).json({
        success: true,
        message: "Generation deleted successfully",
      });
    }
  ),
};

export default generationLibController;
