import { UploadApiOptions, UploadApiResponse } from "cloudinary";
import cloudinary from "../../Config/cloudinary";
import AppError from "../Errors/AppError";
import crypto from "crypto";

export const cloudUpload = async (
  imageBuffer: Buffer,
  folder: string,
  publicId?: string,
  opts?: UploadApiOptions
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions: UploadApiOptions = {
      resource_type: "auto" as const,
      public_id: publicId,
      overwrite: false,
      quality: "auto:good",
      fetch_format: "auto",
      timeout: 60000,
      folder,
      ...opts
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

export const cloudUploadURL = async (
  imageUrl: string,
  folder: string,
  publicId?: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: "auto" as const,
      public_id: publicId,
      overwrite: false,
      quality: "auto:good",
      folder,
    };
    cloudinary.uploader.upload(imageUrl, uploadOptions, (error, result) => {
      if (error) {
        console.log("Cloudinary URL Upload Error:", error);
        reject(new AppError("Cloudinary URL upload failed", 500));
      } else if (!result) {
        reject(new AppError("Cloudinary URL upload returned no result", 500));
      } else {
        resolve(result as UploadApiResponse);
      }
    });
  });
};

export const cloudUploadAudio = async (
  audioBuffer: Buffer,
  folder: string,
  publicId?: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: "video" as const,
      public_id: publicId,
      overwrite: false,
      timeout: 60000,
      format: "mp3",
      folder,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.log("Cloudinary Audio Upload Error:", error);
          reject(new AppError("Cloudinary audio upload failed", 500));
        } else if (!result) {
          reject(
            new AppError("Cloudinary audio upload returned no result", 500)
          );
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );

    stream.end(audioBuffer);
  });
};

export const cloudUploadVideo = async (
  videoBuffer: Buffer,
  folder: string,
  publicId?: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: "video" as const,
      public_id: publicId,
      overwrite: false,
      timeout: 60000,
      folder,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.log("Cloudinary Video Upload Error:", error);
          reject(new AppError("Cloudinary video upload failed", 500));
        } else if (!result) {
          reject(
            new AppError("Cloudinary video upload returned no result", 500)
          );
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );

    stream.end(videoBuffer);
  });
};

export const generateHashFromBuffer = (buffer: Buffer): string => {
  return crypto.createHash("md5").update(buffer).digest("hex");
};

export const deleteCloudinaryResource = async (
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log(`Cloudinary resource deleted: ${publicId}`, result);
    return result;
  } catch (error) {
    console.error(`Failed to delete Cloudinary resource ${publicId}:`, error);
    throw error;
  }
};
