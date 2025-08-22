import cloudinary from "../../Config/cloudinary";
import AppError from "../Errors/AppError";
export const cloudUpload = async (imageBuffer:Buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (error, result) => {
        if (error) {
          console.log("Cloudinary Upload Error:", error);
          reject(new AppError("Cloudinary upload failed", 500));
        } else {
          resolve(result);
        }
      }
    );
    stream.end(imageBuffer); 
  });
};