import path from "path";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";

export class VideoGenerationService {
  constructor() {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path as string);
  }

  async generateVideoFromDescription(
    videoDescription: string,
    refImageUrl: string,
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
    const resultUrl = await wavespeedBase(url, headers, payload);
    return resultUrl;
  }

  async composeSoundWithVideo(
    videoUrl: string,
    audioUrl: string
  ): Promise<string> {
    const outputPath = path.join(__dirname, "output_video.mp4");

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

      return outputPath;
    } catch (error) {
      throw error;
    }
  }

  async mergeScenes(sceneVideos: string[]): Promise<string> {
    const outputPath = path.join(__dirname, "output_merged_video.mp4");

    return new Promise<string>((resolve, reject) => {
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
          console.log("Processing: " + progress.percent + "% done");
        })
        .on("end", () => {
          console.log(
            "Video merging with smooth transitions finished successfully"
          );
          resolve(outputPath);
        })
        .on("error", (err: any) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .run();
    });
  }
}
