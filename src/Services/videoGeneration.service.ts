import path from "path";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { IScene } from "../Interfaces/scene.interface";
import fs from "fs";
import { Readable } from "stream";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";

export class VideoGenerationService {
  constructor() {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path as string);
  }

  async generateVideoFromDescription(
    videoDescription: string,
    refImageUrl: string,
    lastImageUrl: string | null,
    duration: number
  ): Promise<string> {
    let url = `${baseURL}/bytedance/seedance-v1-lite-i2v-480p`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      duration,
      image: refImageUrl,
      prompt: videoDescription,
      seed: -1,
    };
    if (
      lastImageUrl &&
      typeof lastImageUrl === "string" &&
      lastImageUrl.trim() !== ""
    ) {
      Object.assign(payload, { last_image: lastImageUrl });
      console.log("Last Image Assigned: ", lastImageUrl);
    }
    const resultUrl = await wavespeedBase(url, headers, payload);
    return resultUrl;
  }

  async composeSoundWithVideo(
    videoUrl: string,
    audioUrl: string
  ): Promise<Buffer> {
    const outputPath = path.join(__dirname, `output_video_${Date.now()}.mp4`);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(videoUrl)
          .input(audioUrl)
          .audioCodec("aac")
          .videoCodec("libx264")
          .output(outputPath)
          .on("end", () => {
            console.log("File has been converted successfully");
            resolve();
          })
          .on("error", (err: any) => {
            console.error("An error occurred: " + err.message);
            reject(err);
          })
          .run();
      });

      // Read the file as buffer and then delete the local file
      const videoBuffer = fs.readFileSync(outputPath);
      
      // Clean up the temporary file asynchronously for better performance
      fs.unlink(outputPath, (unlinkErr) => {
        if (unlinkErr) {
          console.warn("Failed to clean up temporary file:", unlinkErr);
        } else {
          console.log("Temporary video file cleaned up:", outputPath);
        }
      });

      return videoBuffer;
    } catch (error) {
      // Clean up in case of error (async cleanup)
      fs.unlink(outputPath, (unlinkErr) => {
        if (unlinkErr) {
          console.warn("Failed to clean up temporary file after error:", unlinkErr);
        }
      });
      throw error;
    }
  }

  async mergeScenes(sceneVideos: string[]): Promise<Buffer> {
    if (!sceneVideos || sceneVideos.length === 0) {
      throw new Error("No video URLs provided for merging");
    }

    // Create a unique temporary directory for this merge operation
    const tempDir = path.join(__dirname, `temp_merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const outputPath = path.join(tempDir, "merged_video.mp4");
    const listFilePath = path.join(tempDir, "video_list.txt");

    try {
      // Create temporary directory
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download videos to local temporary files
      const tempVideoFiles: string[] = [];
      const downloadPromises = sceneVideos.map(async (videoUrl, index) => {
        const tempVideoPath = path.join(tempDir, `video_${index}.mp4`);
        
        try {
          const response = await fetch(videoUrl);
          if (!response.ok) {
            throw new Error(`Failed to download video ${index}: ${response.statusText}`);
          }
          
          const buffer = await response.arrayBuffer();
          await fs.promises.writeFile(tempVideoPath, Buffer.from(buffer));
          tempVideoFiles[index] = tempVideoPath;
          console.log(`Downloaded video ${index} to ${tempVideoPath}`);
        } catch (downloadError) {
          console.error(`Error downloading video ${index}:`, downloadError);
          throw new Error(`Failed to download video ${index}: ${downloadError}`);
        }
      });

      await Promise.all(downloadPromises);

      // Create a list file for ffmpeg concat with absolute paths
      const listContent = tempVideoFiles
        .map(filePath => `file '${filePath.replace(/\\/g, '/')}'`)
        .join('\n');
      
      await fs.promises.writeFile(listFilePath, listContent);
      console.log("Created video list file:", listFilePath);

      // Merge videos using ffmpeg concat
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg()
          .input(listFilePath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset', 'medium',
            '-crf', '23',
            '-movflags', '+faststart'
          ])
          .output(outputPath);

        command
          .on('start', (commandLine) => {
            console.log('Started ffmpeg with command:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`Merging progress: ${progress.percent}%`);
          })
          .on('end', () => {
            console.log('Video merging completed successfully');
            resolve();
          })
          .on('error', (err) => {
            console.error('FFmpeg error during video merge:', err);
            reject(new Error(`Video merge failed: ${err.message}`));
          })
          .run();
      });

      // Verify output file exists and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error("Merged video file was not created");
      }

      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error("Merged video file is empty");
      }

      console.log(`Merged video created: ${outputPath}, size: ${stats.size} bytes`);

      // Read the merged video as buffer
      const videoBuffer = await fs.promises.readFile(outputPath);

      return videoBuffer;

    } catch (error) {
      console.error("Error in mergeScenes:", error);
      throw error;
    } finally {
      // Clean up temporary directory and all files
      try {
        if (fs.existsSync(tempDir)) {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
          console.log("Cleaned up temporary directory:", tempDir);
        }
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary directory:", cleanupError);
      }
    }
  }

  async generateVideos(sceneVideos: IScene[]): Promise<string[]> {
    const videoUrls: string[] = [];
    await Promise.all(
      sceneVideos.map(async (scene: IScene, index: number) => {
        const videoUrl = await this.generateVideoFromDescription(
          scene.videoDescription,
          scene.image!,
          index > 0 ? sceneVideos[index - 1].image! : null,
          5
        );
        videoUrls.push(videoUrl);
      })
    );
    return videoUrls;
  }
}
