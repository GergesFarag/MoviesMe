import path from "path";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";
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
      seed: -1,
    };
    const resultUrl = await wavespeedBase(url, headers, payload) as string;
    if (!resultUrl) {
      throw new AppError(
        `Failed to generate video from image`
      );
    }
    return resultUrl;
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

      console.log(`🎵 Downloaded audio buffer size: ${downloadedAudioBuffer.length} bytes`);

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
      console.log(`📹 Using calculated video duration: ${videoDuration} seconds`);

      // Compose video with audio using optimized ffmpeg settings
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg()
          .input(tempVideoPath)
          .input(tempAudioPath)
          .videoCodec("copy") // Copy video stream without re-encoding (much faster)
          .audioCodec("aac")
          .audioChannels(2) // Ensure stereo audio
          .audioFrequency(44100) // Standard audio frequency
          .outputOptions([
            "-map",
            "0:v:0", // Map first video stream
            "-map",
            "1:a:0", // Map first audio stream
            "-c:v", "copy", // Copy video without re-encoding
            "-c:a", "aac", // Encode audio as AAC
            "-t", videoDuration.toString(), // Cut to video duration (audio will be trimmed if longer)
            "-avoid_negative_ts",
            "make_zero",
            "-fflags",
            "+genpts",
            "-movflags",
            "+faststart",
            "-y", // Overwrite output file if it exists
          ])
          .output(outputPath);

        console.log(`🎵 Audio will be cut to match video duration: ${videoDuration} seconds`);

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
        const videoUrl = await this.generateVideoFromImage(
          image,
          5
        );
        videoUrls.push(videoUrl);
      } catch (error) {
        console.error("Error generating video for scene:", error);
      }
    }
    return videoUrls;
  }
}
