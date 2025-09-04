import { UploadApiResponse } from "cloudinary";
import cloudinary from "../../Config/cloudinary";
import AppError from "../Errors/AppError";
import crypto from "crypto";

export const cloudUpload = async (imageBuffer: Buffer, publicId?: string): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: 'auto' as const,
      public_id: publicId,
      overwrite: false,
      quality: 'auto:good',
      fetch_format: 'auto',
      timeout: 60000
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.log("Cloudinary Upload Error:", error);
          reject(new AppError("Cloudinary upload failed", 500));
        } else if (!result) {
          reject(new AppError("Cloudinary upload returned no result", 500));
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );
    
    stream.end(imageBuffer);
  });
};

export const cloudUploadAudio = async (audioBuffer: Buffer, publicId?: string): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: 'video' as const, 
      public_id: publicId,
      overwrite: false,
      timeout: 60000,
      format: 'mp3'
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.log("Cloudinary Audio Upload Error:", error);
          reject(new AppError("Cloudinary audio upload failed", 500));
        } else if (!result) {
          reject(new AppError("Cloudinary audio upload returned no result", 500));
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );
    
    stream.end(audioBuffer);
  });
};

export const generateImageHash = (buffer: Buffer): string => {
  return crypto.createHash("md5").update(buffer).digest("hex");
};