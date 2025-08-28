import { UploadApiResponse } from "cloudinary";
import cloudinary from "../../Config/cloudinary";
import AppError from "../Errors/AppError";
import crypto from "crypto";
export const cloudUpload = async (imageBuffer:Buffer , publicId?:string) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', public_id: publicId , overwrite:false },
      (error, result) => {
        if (error) {
          console.log("Cloudinary Upload Error:", error);
          reject(new AppError("Cloudinary upload failed", 500));
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );
    stream.end(imageBuffer); 
  });
};
export const generateImageHash = (buffer: Buffer) => {
  return crypto.createHash("md5").update(buffer).digest("hex");
};