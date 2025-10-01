import path from "path";
import {
  wavespeedBase,
  wavespeedBaseOptimized,
} from "../Utils/APIs/wavespeed_base";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { IScene } from "../Interfaces/scene.interface";
import fs from "fs";
import { Readable } from "stream";
import AppError from "../Utils/Errors/AppError";
import { downloadFile } from "../Utils/Format/downloadFile";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";

export class VideoGenerationService {
  constructor() {
    // Configure FFmpeg path using the installer
    try {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      console.log("✅ FFmpeg configured successfully:", ffmpegInstaller.path);
    } catch (error) {
      console.error("❌ Failed to configure FFmpeg:", error);
      throw new AppError("FFmpeg configuration failed", 500);
    }
  }

  async generateVideoFromImage(
    refImageUrl: string,
    duration: number,
    prompt?: string
  ): Promise<string> {
    let url = `${baseURL}/bytedance/seedance-v1-lite-i2v-480p`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      duration,
      image: refImageUrl,
      seed: -1,
    };
    console.log("Payload for video generation:", payload);
    try {
      console.log(`🎥 Starting optimized video generation from image...`);

      const resultUrl = (await wavespeedBaseOptimized(
        url,
        headers,
        payload
      )) as string;

      if (!resultUrl) {
        throw new AppError(
          "No video URL returned from optimized generation",
          500
        );
      }

      console.log(
        `✅ Video generated successfully with optimized polling: ${resultUrl.substring(
          0,
          50
        )}...`
      );
      return resultUrl;
    } catch (error) {
      console.error("❌ Optimized video generation failed:", error);

      // Fallback to original implementation
      console.log("🔄 Falling back to legacy video generation...");
      try {
        const resultUrl = (await wavespeedBase(
          url,
          headers,
          payload
        )) as string;
        if (!resultUrl) {
          throw new AppError(
            "Failed to generate video from image using fallback",
            500
          );
        }
        console.log(
          `✅ Video generated with legacy polling: ${resultUrl.substring(
            0,
            50
          )}...`
        );
        return resultUrl;
      } catch (fallbackError) {
        console.error("❌ Legacy video generation also failed:", fallbackError);
        throw new AppError(
          "Video generation failed (both optimized and legacy methods)",
          500
        );
      }
    }
  }

  async composeSoundWithVideoBuffer(
    videoBuffer: Buffer,
    audioUrl: string,
    numOfScenes: number
  ): Promise<Buffer> {
    if (!videoBuffer || videoBuffer.length === 0) {
      throw new AppError("Valid video buffer is required", 400);
    }
    if (!audioUrl) {
      throw new AppError("Audio URL is required", 400);
    }

    // Create a unique temporary directory for this operation
    const tempDir = path.join(
      __dirname,
      `temp_compose_buffer_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`
    );
    const outputPath = path.join(tempDir, "composed_video.mp4");

    try {
      await fs.promises.mkdir(tempDir, { recursive: true });

      const [downloadedAudioBuffer] = await Promise.all([
        downloadFile(audioUrl, "audio"),
      ]);

      console.log(
        `🎵 Downloaded audio buffer size: ${downloadedAudioBuffer.length} bytes`
      );

      if (!downloadedAudioBuffer || downloadedAudioBuffer.length === 0) {
        throw new AppError("Downloaded audio buffer is empty", 500);
      }

      const tempVideoPath = path.join(tempDir, "input_video.mp4");
      const tempAudioPath = path.join(tempDir, "input_audio.mp3");

      await Promise.all([
        fs.promises.writeFile(tempVideoPath, videoBuffer),
        fs.promises.writeFile(tempAudioPath, downloadedAudioBuffer),
      ]);

      console.log(`📁 Created temporary files:`);
      console.log(`  Video: ${tempVideoPath}`);
      console.log(`  Audio: ${tempAudioPath}`);

      const videoStats = await fs.promises.stat(tempVideoPath);
      const audioStats = await fs.promises.stat(tempAudioPath);

      console.log(`📊 File sizes:`);
      console.log(`  Video: ${videoStats.size} bytes`);
      console.log(`  Audio: ${audioStats.size} bytes`);

      if (videoStats.size === 0) {
        throw new Error("Video file is empty");
      }
      if (audioStats.size === 0) {
        throw new Error("Audio file is empty");
      }

      // Use default video duration (no ffprobe)
      const videoDuration = numOfScenes * 5; // 5 seconds per scene
      console.log(
        `📹 Using calculated video duration: ${videoDuration} seconds`
      );

      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg()
          .input(tempVideoPath)
          .input(tempAudioPath)
          .videoCodec("copy")
          .audioCodec("aac")
          .audioChannels(2)
          .audioFrequency(44100) // Standard audio frequency
          .outputOptions([
            "-map",
            "0:v:0", // Map first video stream
            "-map",
            "1:a:0", // Map first audio stream
            "-c:v",
            "copy", // Copy video without re-encoding
            "-c:a",
            "aac", // Encode audio as AAC
            "-t",
            videoDuration.toString(), // Cut to video duration (audio will be trimmed if longer)
            "-avoid_negative_ts",
            "make_zero",
            "-fflags",
            "+genpts",
            "-movflags",
            "+faststart",
            "-y", // Overwrite output file if it exists
          ])
          .output(outputPath);

        console.log(
          `🎵 Audio will be cut to match video duration: ${videoDuration} seconds`
        );

        command
          .on("start", (commandLine) => {
            console.log(
              "🎬 Started audio composition with video buffer, command:",
              commandLine
            );
          })
          .on("progress", (progress) => {
            console.log(`⏳ FFmpeg progress: ${progress.percent}% done`);
          })
          .on("stderr", (stderrLine) => {
            console.log(`📝 FFmpeg stderr: ${stderrLine}`);
          })
          .on("end", () => {
            console.log(
              "✅ Audio composition with video buffer completed successfully"
            );
            resolve();
          })
          .on("error", (err) => {
            console.error(
              "❌ FFmpeg error during audio composition with buffer:",
              err
            );
            console.error("❌ Error details:", {
              message: err.message,
              stack: err.stack,
            });
            reject(
              new AppError(
                `Audio composition with buffer failed: ${err.message}`,
                500
              )
            );
          })
          .run();
      });

      // Verify output file exists and has content
      if (!fs.existsSync(outputPath)) {
        throw new AppError("Composed video file was not created", 500);
      }

      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new AppError("Composed video file is empty", 500);
      }

      console.log(
        `Composed video created from buffer: ${outputPath}, size: ${stats.size} bytes`
      );

      // Read the composed video as buffer
      const composedVideoBuffer = await fs.promises.readFile(outputPath);

      return composedVideoBuffer;
    } catch (error) {
      console.error("Error in composeSoundWithVideoBuffer:", error);
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

  async mergeScenes(sceneVideos: string[]): Promise<Buffer> {
    if (!sceneVideos || sceneVideos.length === 0) {
      throw new Error("No video URLs provided for merging");
    }

    const tempDir = path.join(
      __dirname,
      `temp_merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
    const outputPath = path.join(tempDir, "merged_video.mp4");
    const listFilePath = path.join(tempDir, "video_list.txt");

    try {
      await fs.promises.mkdir(tempDir, { recursive: true });

      const tempVideoFiles: string[] = [];
      const downloadPromises = sceneVideos.map(async (videoUrl, index) => {
        const tempVideoPath = path.join(tempDir, `video_${index}.mp4`);

        try {
          const response = await fetch(videoUrl);
          if (!response.ok) {
            throw new AppError(
              `Failed to download video ${index}: ${response.statusText}`,
              500
            );
          }

          const buffer = await response.arrayBuffer();
          await fs.promises.writeFile(tempVideoPath, Buffer.from(buffer));
          tempVideoFiles[index] = tempVideoPath;
          console.log(`Downloaded video ${index} to ${tempVideoPath}`);
        } catch (downloadError) {
          console.error(`Error downloading video ${index}:`, downloadError);
          throw new AppError(
            `Failed to download video ${index}: ${downloadError}`,
            500
          );
        }
      });

      await Promise.all(downloadPromises);

      const listContent = tempVideoFiles
        .map((filePath) => `file '${filePath.replace(/\\/g, "/")}'`)
        .join("\n");

      await fs.promises.writeFile(listFilePath, listContent);
      console.log("Created video list file:", listFilePath);

      // Merge videos using ffmpeg concat
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg()
          .input(listFilePath)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            "-preset",
            "medium",
            "-crf",
            "23",
            "-movflags",
            "+faststart",
          ])
          .output(outputPath);

        command
          .on("start", (commandLine) => {
            console.log("Started ffmpeg with command:", commandLine);
          })
          .on("end", () => {
            console.log("Video merging completed successfully");
            resolve();
          })
          .on("error", (err) => {
            console.error("FFmpeg error during video merge:", err);
            reject(new AppError(`Video merge failed: ${err.message}`, 500));
          })
          .run();
      });

      // Verify output file exists and has content
      if (!fs.existsSync(outputPath)) {
        throw new AppError("Merged video file was not created", 500);
      }

      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new AppError("Merged video file is empty", 500);
      }

      console.log(
        `Merged video created: ${outputPath}, size: ${stats.size} bytes`
      );

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

  async generateVideos(sceneImages: string[]): Promise<string[]> {
    const videoUrls: string[] = [];
    for (const image of sceneImages) {
      try {
        const videoUrl = await this.generateVideoFromImage(image, 5);
        videoUrls.push(videoUrl);
      } catch (error) {
        console.error("Error generating video for scene:", error);
      }
    }
    return videoUrls;
  }

  async generateVideosParallel(sceneImages: string[]): Promise<string[]> {
    if (!sceneImages || sceneImages.length === 0) {
      throw new AppError("No scene images provided for video generation", 400);
    }

    console.log(`🎬 Generating ${sceneImages.length} videos in parallel...`);

    // Create promises for parallel video generation
    const videoGenerationPromises = sceneImages.map(async (imageUrl, index) => {
      const sceneNumber = index + 1;

      try {
        console.log(
          `🎥 Starting video generation for scene ${sceneNumber}/${sceneImages.length}`
        );

        const videoUrl = await this.generateVideoFromImage(imageUrl, 5);

        if (
          !videoUrl ||
          typeof videoUrl !== "string" ||
          !videoUrl.startsWith("http")
        ) {
          throw new AppError(
            `Invalid video URL generated for scene ${sceneNumber}`,
            500
          );
        }

        console.log(
          `✅ Scene ${sceneNumber} video generated successfully: ${videoUrl.substring(
            0,
            50
          )}...`
        );
        return { index, videoUrl, success: true };
      } catch (error) {
        console.error(
          `❌ Failed to generate video for scene ${sceneNumber}:`,
          error
        );
        return {
          index,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    });

    try {
      // Wait for all video generation promises to settle
      const results = await Promise.allSettled(videoGenerationPromises);

      // Process results and handle errors
      const videoUrls: string[] = new Array(sceneImages.length);
      const failedScenes: number[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const { index: sceneIndex, videoUrl, success, error } = result.value;

          if (success && videoUrl) {
            videoUrls[sceneIndex] = videoUrl;
          } else {
            failedScenes.push(sceneIndex + 1);
            console.error(`Scene ${sceneIndex + 1} failed:`, error);
          }
        } else {
          failedScenes.push(index + 1);
          console.error(`Scene ${index + 1} promise rejected:`, result.reason);
        }
      });

      // Check for failures
      if (failedScenes.length > 0) {
        const errorMessage = `Failed to generate videos for ${
          failedScenes.length
        } scene(s): ${failedScenes.join(", ")}`;
        console.error(`❌ ${errorMessage}`);
        throw new AppError(errorMessage, 500);
      }

      // Validate all URLs are present
      const missingUrls = videoUrls
        .map((url, index) => (url ? null : index + 1))
        .filter(Boolean);
      if (missingUrls.length > 0) {
        throw new AppError(
          `Missing video URLs for scenes: ${missingUrls.join(", ")}`,
          500
        );
      }

      console.log(
        `🎉 Successfully generated ${videoUrls.length} videos in parallel`
      );
      return videoUrls;
    } catch (error) {
      console.error("❌ Parallel video generation failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Parallel video generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500
      );
    }
  }

  async generateVideoForGenerationLib(
    refImage: string | undefined,
    duration: number,
    prompt: string
  ): Promise<string> {
    let url = "";
    if (!refImage) {
      url = `${baseURL}/bytedance/seedance-v1-lite-t2v-480p`;
    } else {
      url = `${baseURL}/bytedance/seedance-v1-lite-i2v-480p`;
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload: any = {
      image: refImage,
      duration,
      seed: -1,
    };
    prompt && Object.assign(payload, { prompt });
    console.log("Payload for video generation:", payload);
    console.log("URL for video generation:", url);
    try {
      const response = (await wavespeedBaseOptimized(url, headers, payload)) as string;
      console.log("RESPONSE : " , response)
      console.log(
        `✅ Video generated successfully for generation lib: ${url.substring(
          0,
          50
        )}...`
      );
      return response;
    } catch (error) {
      console.error("Error generating video for generation lib:", error);
      throw new AppError(
        `Video generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500
      );
    }
  }
}
