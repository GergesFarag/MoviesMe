import { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import cloudinary from '../../Config/cloudinary';
import AppError from '../Errors/AppError';
import crypto from 'crypto';

export const cloudUpload = async (
  imageBuffer: Buffer,
  folder: string,
  publicId?: string,
  opts?: UploadApiOptions
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions: UploadApiOptions = {
      resource_type: 'auto' as const,
      public_id: publicId,
      overwrite: false,
      quality: 'auto:good',
      fetch_format: 'auto',
      timeout: 60000,
      folder,
      ...opts,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.log('Cloudinary Upload Error:', error);
          reject(new AppError('Cloudinary upload failed', 500));
        } else if (!result) {
          reject(new AppError('Cloudinary upload returned no result', 500));
        } else {
          resolve(result as UploadApiResponse);
        }
      }
    );

    stream.end(imageBuffer);
  });
};

export const cloudUploadURL = async (
  url: string,
  folder: string,
  publicId?: string,
  resourceType?: 'video' | 'image' | 'auto' | 'raw' | undefined
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: resourceType ?? 'auto',
      public_id: publicId,
      overwrite: false,
      quality: 'auto:good',
      folder,
    };
    cloudinary.uploader.upload(url, uploadOptions, (error, result) => {
      if (error) {
        console.log('Cloudinary URL Upload Error:', error);
        reject(new AppError('Cloudinary URL upload failed', 500));
      } else if (!result) {
        reject(new AppError('Cloudinary URL upload returned no result', 500));
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
      resource_type: 'video' as const,
      public_id: publicId,
      overwrite: false,
      timeout: 60000,
      format: 'mp3',
      folder,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.log('Cloudinary Audio Upload Error:', error);
          reject(new AppError('Cloudinary audio upload failed', 500));
        } else if (!result) {
          reject(
            new AppError('Cloudinary audio upload returned no result', 500)
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
      resource_type: 'video' as const,
      public_id: publicId,
      overwrite: false,
      timeout: 60000,
      folder,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.log('Cloudinary Video Upload Error:', error);
          reject(new AppError('Cloudinary video upload failed', 500));
        } else if (!result) {
          reject(
            new AppError('Cloudinary video upload returned no result', 500)
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
  return crypto.createHash('md5').update(buffer).digest('hex');
};

export const cloudUploadLargeBuffer = async (
  buffer: Buffer,
  folder: string,
  publicId?: string,
  resourceType: 'video' | 'image' | 'auto' | 'raw' = 'auto',
  opts?: UploadApiOptions
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    // Configuration for large files
    const uploadOptions: UploadApiOptions = {
      resource_type: resourceType,
      public_id: publicId,
      overwrite: false,
      folder,
      timeout: 300000, // 5 minutes timeout for large files
      chunk_size: 6000000, // 6MB chunks for better handling of large files
      ...opts,
    };

    console.log(
      `📤 Uploading large buffer to Cloudinary - Size: ${(
        buffer.length /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary Large Upload Error:', {
            message: error.message,
            http_code: error.http_code,
          });
          reject(
            new AppError(
              `Cloudinary large upload failed: ${error.message}`,
              error.http_code || 500
            )
          );
        } else if (!result) {
          reject(
            new AppError('Cloudinary large upload returned no result', 500)
          );
        } else {
          console.log(
            `✅ Large buffer uploaded successfully: ${result.public_id}`
          );
          resolve(result as UploadApiResponse);
        }
      }
    );

    // Handle stream errors
    stream.on('error', (error) => {
      console.error('❌ Stream error during large upload:', error);
      reject(new AppError('Stream error during upload', 500));
    });

    // Write buffer to stream
    stream.end(buffer);
  });
};

export const cloudUploadExtraLargeBuffer = async (
  buffer: Buffer,
  folder: string,
  publicId?: string,
  resourceType: 'video' | 'image' | 'auto' | 'raw' = 'auto',
  opts?: UploadApiOptions
): Promise<UploadApiResponse> => {
  const fs = require('fs').promises;
  const path = require('path');
  const os = require('os');

  // Create a temporary file for very large uploads (>100MB)
  const tempDir = os.tmpdir();
  const tempFileName = `cloudinary_upload_${Date.now()}_${crypto
    .randomBytes(8)
    .toString('hex')}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    const bufferSizeMB = buffer.length / 1024 / 1024;
    console.log(
      `📤 Uploading extra large buffer - Size: ${bufferSizeMB.toFixed(2)} MB`
    );

    // Write buffer to temporary file
    await fs.writeFile(tempFilePath, buffer);
    console.log(`💾 Temporary file created: ${tempFilePath}`);

    // Upload using upload_large which handles chunking automatically
    const uploadOptions: UploadApiOptions = {
      resource_type: resourceType,
      public_id: publicId,
      overwrite: false,
      folder,
      timeout: 600000, // 10 minutes for extra large files
      chunk_size: 10000000, // 10MB chunks
      use_filename: false,
      unique_filename: !publicId,
      ...opts,
    };

    const result = await cloudinary.uploader.upload_large(
      tempFilePath,
      uploadOptions
    );

    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
      console.log(`🗑️  Temporary file cleaned up`);
    } catch (cleanupError) {
      console.warn(`⚠️  Could not delete temp file: ${tempFilePath}`);
    }

    return result as UploadApiResponse;
  } catch (error: any) {
    // Ensure temp file cleanup on error
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    console.error('❌ Extra large upload failed:', {
      message: error.message,
      http_code: error.http_code,
    });

    throw new AppError(
      `Extra large upload failed: ${error.message}`,
      error.http_code || 500
    );
  }
};

export const deleteCloudinaryResource = async (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
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

export const composeVideoWithAudio = async (
  videoPublicId: string,
  audioPublicId: string,
  folder?: string
) => {
  try {
    const result = await cloudinary.uploader.explicit(
      'user_68dc6b7e0dfbb81d538692ab/processing_videos/custom_video_1761868361827',
      {
        resource_type: 'video',
        type: 'upload',
        eager: [
          {
            transformation: [
              {
                overlay:
                  'video:user_68dc6b7e0dfbb81d538692ab:processing_videos:custom_video_1761868340796',
                flags: 'splice',
              },
              { flags: 'layer_apply' },
            ],
          },
        ],
      }
    );

    console.log(result.eager);
  } catch (error) {
    console.error('Failed to compose video with audio:', error);
    throw new AppError('Video composition failed', 500);
  }
};

export const deleteCloudinaryFolder = async (
  folderPath: string
): Promise<boolean> => {
  try {
    await cloudinary.api.delete_resources_by_prefix(folderPath, {
      resource_type: 'image',
      type: 'upload',
    });
    await cloudinary.api.delete_resources_by_prefix(folderPath, {
      resource_type: 'video',
      type: 'upload',
    });
    await cloudinary.api.delete_resources_by_prefix(folderPath, {
      resource_type: 'raw',
      type: 'upload',
    });
    try {
      await cloudinary.api.delete_folder(folderPath);
      console.log(`Successfully deleted main folder: ${folderPath}`);
    } catch (folderError: any) {
      console.log(`Could not delete main folder: ${folderError?.message}`);
    }

    console.log(`Cloudinary folder deletion completed: ${folderPath}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to delete Cloudinary folder ${folderPath}:`, error);
    throw new AppError(
      `Failed to delete folder: ${error?.message || 'Unknown error'}`,
      500
    );
  }
};
