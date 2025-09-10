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
    const outputPath = path.join(__dirname, `output_merged_video_${Date.now()}.mp4`);

    return new Promise<Buffer>((resolve, reject) => {
      let command = ffmpeg();

      // Add all input URLs
      sceneVideos.forEach((videoUrl) => {
        command = command.input(videoUrl);
      });

      // Create smooth transitions between scenes
      let filterComplex = "";

      if (sceneVideos.length === 1) {
        // Single video - just scale and format
        filterComplex = `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=in:0:15,fade=out:st=5:d=15[outv]`;
      } else {
        // Multiple videos - apply fade in/out for smooth transitions
        for (let i = 0; i < sceneVideos.length; i++) {
          let fadeFilters = "";

          if (i === 0) {
            // First video: fade in at start, fade out at end
            fadeFilters = "fade=in:0:15,fade=out:st=5:d=15";
          } else if (i === sceneVideos.length - 1) {
            // Last video: fade in at start
            fadeFilters = "fade=in:0:15";
          } else {
            // Middle videos: fade in at start, fade out at end
            fadeFilters = "fade=in:0:15,fade=out:st=5:d=15";
          }

          filterComplex += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,${fadeFilters}[v${i}];`;
        }

        // Concatenate all processed videos
        filterComplex +=
          sceneVideos.map((_, index) => `[v${index}]`).join("") +
          `concat=n=${sceneVideos.length}:v=1:a=0[outv]`;
      }

      command
        .complexFilter(filterComplex)
        .outputOptions([
          "-map [outv]",
          "-c:v libx264",
          "-preset medium",
          "-crf 23",
          "-r 30",
          "-an",
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log(
            "FFmpeg command (video-only with smooth transitions):",
            commandLine
          );
        })
        .on("progress", (progress) => {
          if (progress.percent && progress.percent > 0) {
            console.log("Processing: " + progress.percent.toFixed(2) + "% done");
          }
        })
        .on("end", () => {
          console.log(
            "Video merging with smooth transitions finished successfully"
          );
          
          // Read the file as buffer and then delete the local file
          try {
            const videoBuffer = fs.readFileSync(outputPath);
            
            // Clean up the temporary file immediately after reading
            fs.unlink(outputPath, (unlinkErr) => {
              if (unlinkErr) {
                console.warn("Failed to clean up temporary merged file:", unlinkErr);
              } else {
                console.log("Temporary merged video file cleaned up:", outputPath);
              }
            });
            
            resolve(videoBuffer);
          } catch (readError) {
            console.error("Failed to read merged video file:", readError);
            // Try to clean up even on error
            fs.unlink(outputPath, (unlinkErr) => {
              if (unlinkErr) {
                console.warn("Failed to clean up file after read error:", unlinkErr);
              }
            });
            reject(readError);
          }
        })
        .on("error", (err: any) => {
          console.error("FFmpeg error:", err);
          
          // Clean up in case of error (async cleanup)
          fs.unlink(outputPath, (unlinkErr) => {
            if (unlinkErr) {
              console.warn("Failed to clean up temporary file after FFmpeg error:", unlinkErr);
            }
          });
          
          reject(err);
        })
        .run();
    });
  }

  async generateVideos(sceneVideos: IScene[]): Promise<string[]> {
    const videoUrls: string[] = [];
    await Promise.all(
      sceneVideos.map(async (scene: IScene, index: number) => {
        const videoUrl = await this.generateVideoFromDescription(
          scene.videoDescription,
          scene.image,
          index > 0 ? sceneVideos[index - 1].image : null,
          5
        );
        videoUrls.push(videoUrl);
      })
    );
    return videoUrls;
  }
}
