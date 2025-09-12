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

  async composeSoundWithVideoBuffer(
    videoBuffer: Buffer,
    audioUrl: string
  ): Promise<Buffer> {
    if (!videoBuffer || videoBuffer.length === 0) {
      throw new Error("Valid video buffer is required");
    }
    if (!audioUrl) {
      throw new Error("Audio URL is required");
    }

    // Create a unique temporary directory for this operation
    const tempDir = path.join(__dirname, `temp_compose_buffer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const outputPath = path.join(tempDir, "composed_video.mp4");

    try {
      // Create temporary directory
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download audio file and write video buffer to disk in parallel
      const [downloadedAudioBuffer] = await Promise.all([
        this.downloadFile(audioUrl, "audio")
      ]);

      // Write video buffer and audio to temporary location
      const tempVideoPath = path.join(tempDir, "input_video.mp4");
      const tempAudioPath = path.join(tempDir, "input_audio.mp3");

      await Promise.all([
        fs.promises.writeFile(tempVideoPath, videoBuffer),
        fs.promises.writeFile(tempAudioPath, downloadedAudioBuffer)
      ]);

      console.log("Saved video buffer and downloaded audio file locally");
      console.log(`Video buffer size: ${videoBuffer.length} bytes`);
      console.log(`Audio buffer size: ${downloadedAudioBuffer.length} bytes`);

      // Verify the input files exist and have content
      const videoStats = await fs.promises.stat(tempVideoPath);
      const audioStats = await fs.promises.stat(tempAudioPath);
      console.log(`Video file: ${tempVideoPath}, size: ${videoStats.size} bytes`);
      console.log(`Audio file: ${tempAudioPath}, size: ${audioStats.size} bytes`);

      if (videoStats.size === 0) {
        throw new Error("Video file is empty");
      }
      if (audioStats.size === 0) {
        throw new Error("Audio file is empty");
      }

      // Compose video with audio using optimized ffmpeg settings
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg()
          .input(tempVideoPath)
          .input(tempAudioPath)
          .videoCodec('copy') // Copy video stream without re-encoding (much faster)
          .audioCodec('aac')
          .outputOptions([
            '-map', '0:v:0', // Map first video stream
            '-map', '1:a:0', // Map first audio stream
            '-shortest',     // End when shortest input ends
            '-avoid_negative_ts', 'make_zero',
            '-fflags', '+genpts',
            '-movflags', '+faststart',
            '-y' // Overwrite output file if it exists
          ])
          .output(outputPath);

        command
          .on('start', (commandLine) => {
            console.log('🎬 Started audio composition with video buffer, command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`🎵 Audio composition progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on('stderr', (stderrLine) => {
            console.log('FFmpeg stderr:', stderrLine);
          })
          .on('end', () => {
            console.log('✅ Audio composition with video buffer completed successfully');
            resolve();
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg error during audio composition with buffer:', err);
            reject(new Error(`Audio composition with buffer failed: ${err.message}`));
          })
          .run();
      });

      // Verify output file exists and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error("Composed video file was not created");
      }

      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error("Composed video file is empty");
      }

      console.log(`Composed video created from buffer: ${outputPath}, size: ${stats.size} bytes`);

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

  private async downloadFile(url: string, type: 'video' | 'audio'): Promise<Buffer> {
    try {
      console.log(`Downloading ${type} from:`, url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download ${type}: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      console.log(`Downloaded ${type} successfully, size: ${buffer.byteLength} bytes`);
      
      return Buffer.from(buffer);
    } catch (error) {
      console.error(`Error downloading ${type}:`, error);
      throw new Error(`Failed to download ${type} from ${url}: ${error}`);
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
