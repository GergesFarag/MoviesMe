import { Job } from "bull";
import { IStoryProcessingDTO } from "../../DTOs/storyRequest.dto";
import JobModel from "../../Models/job.model";
import Story from "../../Models/story.model";
import AppError from "../../Utils/Errors/AppError";
import { ImageGenerationService } from "../imageGeneration.service";
import { OpenAIService } from "../openAi.service";
import { VideoGenerationService } from "../videoGeneration.service";
import { VoiceGenerationService } from "../voiceGeneration.service";
import { IStoryResponse } from "../../Interfaces/storyResponse.interface";
import { IProcessedVoiceOver } from "../../Interfaces/audioModel.interface";
import { RepositoryOrchestrationService } from "../../Services/repositoryOrchestration.service";
import {
  cloudUploadURL,
  cloudUploadVideo,
  generateHashFromBuffer,
} from "../../Utils/APIs/cloudinary";
import { StoryProcessingResult } from "../../Interfaces/story.interface";
import StoryGenerationInfo from "../../Models/storyGenerationInfo.model";
import logger from "../../Config/logger";
import { sendWebsocket } from "../../Sockets/socket";
import {
  QUEUE_EVENTS,
  startProgressUpdates,
  stopProgressUpdates,
  sendProgressUpdate,
} from "../generateStory.service";
import { CLOUDINAT_FOLDERS } from "../../Constants/cloud";
import { randomBytes } from "crypto";
import { UploadApiResponse } from "cloudinary";
import { SFXService } from "../sfx.service";
import { StoryRepository } from "../../Repositories/StoryRepository";
import { HTTP_STATUS_CODE } from "../../Enums/error.enum";

export class StoryProcessorService {
  constructor(
    private imageGenerationService: ImageGenerationService,
    private videoGenerationService: VideoGenerationService,
    private voiceGenerationService: VoiceGenerationService,
    private sfxService: SFXService
  ) {}

  public async processStory(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<StoryProcessingResult> {
    try {
      console.log(
        `🚀 Starting story processing for job ${job.id} with jobId: ${jobData.jobId}`
      );

      sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        0,
        "Starting story processing"
      );

      await this.validateJobData(job, jobData);

      if (jobData.voiceOver || jobData.audio) {
        const initialVoiceOver = {
          voiceOverLyrics: jobData.voiceOver?.voiceOverLyrics ?? null,
          voiceLanguage: jobData.voiceOver?.voiceLanguage ?? null,
          voiceAccent: jobData.voiceOver?.voiceAccent ?? null,
          voiceGender: jobData.voiceOver?.voiceGender ?? null,
          sound: jobData.audio ?? jobData.voiceOver?.sound ?? null,
          text: jobData.voiceOver?.text ?? null,
        } as any;

        const isUpdated = await StoryRepository.getInstance().updateVoiceOver(
          jobData.jobId,
          initialVoiceOver
        );
        if (!isUpdated) {
          throw new AppError("Failed to update voice over", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
        }
      }

      startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        0,
        10,
        "Generating story"
      );

      const { story, seedreamPrompt, toVoiceGenerationText } =
        await this.generateStory(job, jobData);
      stopProgressUpdates(jobData.jobId);
      sendProgressUpdate(jobData.userId, jobData.jobId, 10, "Story generated");

      console.log(
        "🚀 Starting parallel processing: Voice Over + Image Generation"
      );
      logger.info({ seedreamPrompt });
      let [voiceOver, imageUrls]: [
        IProcessedVoiceOver | null,
        string[] | null
      ] = [null, null];

      if (jobData.voiceOver) {
        startProgressUpdates(
          jobData.userId,
          jobData.jobId,
          10,
          40,
          "Generating voice over and images"
        );
        [voiceOver, imageUrls] = await Promise.all([
          this.processVoiceOverWithProgress(
            job,
            jobData,
            toVoiceGenerationText
          ),
          this.generateImagesWithProgress(job, jobData, seedreamPrompt),
        ]);
        stopProgressUpdates(jobData.jobId);
        sendProgressUpdate(
          jobData.userId,
          jobData.jobId,
          40,
          "Voice over and images generated"
        );
      } else {
        startProgressUpdates(
          jobData.userId,
          jobData.jobId,
          10,
          35,
          "Generating images"
        );
        imageUrls = await this.generateImagesWithProgress(
          job,
          jobData,
          seedreamPrompt
        );
        stopProgressUpdates(jobData.jobId);
        sendProgressUpdate(
          jobData.userId,
          jobData.jobId,
          35,
          "Images generated"
        );
      }

      console.log(
        "✅ Parallel processing completed: Voice Over + Image Generation"
      );
      const updatedStory = this.updateStoryWithImages(story, imageUrls ?? []);

      const videoStartProgress = jobData.voiceOver ? 40 : 35;
      const videoEndProgress = jobData.voiceOver ? 70 : 65;
      startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        videoStartProgress,
        videoEndProgress,
        "Generating videos"
      );
      const videoUrls = await this.generateVideos(job, imageUrls ?? []);
      stopProgressUpdates(jobData.jobId);
      sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        videoEndProgress,
        "Videos generated"
      );

      if (jobData.audio) {
        console.log("⏭️ Using provided audio, skipping voice over generation");
        voiceOver = {
          url: jobData.audio,
          PID: null,
          text: null,
          data: {
            voiceOverLyrics: null,
            voiceLanguage: null,
            voiceGender: null,
            voiceAccent: null,
          },
        };
      }

      const mergeStartProgress = jobData.voiceOver ? 70 : 65;
      const mergeEndProgress = jobData.voiceOver ? 85 : 80;
      startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        mergeStartProgress,
        mergeEndProgress,
        "Merging and composing video"
      );
      const finalVideoUrl = (await this.mergeAndComposeVideo(
        job,
        videoUrls,
        voiceOver,
        jobData
      )) as string;
      stopProgressUpdates(jobData.jobId);
      sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        mergeEndProgress,
        "Video merged and composed"
      );

      const uploadStartProgress = jobData.voiceOver ? 85 : 80;
      const uploadEndProgress = jobData.voiceOver ? 95 : 90;
      startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        uploadStartProgress,
        uploadEndProgress,
        "Uploading video"
      );
      stopProgressUpdates(jobData.jobId);
      sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        uploadEndProgress,
        "Video uploaded"
      );

      // Save to database: 95-100%
      const saveStartProgress = jobData.voiceOver ? 95 : 90;
      startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        saveStartProgress,
        99,
        "Saving story"
      );
      const completedStory = await this.saveCompletedStory(
        job,
        updatedStory,
        finalVideoUrl,
        voiceOver,
        jobData
      );
      stopProgressUpdates(jobData.jobId);

      sendProgressUpdate(jobData.userId, jobData.jobId, 100, "Story completed");
      sendWebsocket(
        QUEUE_EVENTS.STORY_COMPLETED,
        {
          jobId: jobData.jobId,
          story: completedStory,
          videoUrl: finalVideoUrl,
        },
        `user:${jobData.userId}`
      );

      console.log(
        `✅ Story processing completed successfully for jobId: ${jobData.jobId}`
      );

      return {
        finalVideoUrl,
        story: completedStory,
      };
    } catch (error) {
      console.error(
        `❌ Story processing failed for jobId: ${jobData.jobId}`,
        error
      );

      stopProgressUpdates(jobData.jobId);
      sendWebsocket(
        QUEUE_EVENTS.STORY_FAILED,
        {
          jobId: jobData.jobId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        `user:${jobData.userId}`
      );

      throw error;
    }
  }

  private async validateJobData(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<void> {
    if (!jobData.userId || !jobData.jobId) {
      console.log(`❌ VALIDATION FAILED: Missing userId or jobId`);
      throw new AppError("Missing required job data: userId or jobId", 400);
    }

    if (!jobData.prompt) {
      console.log(`❌ VALIDATION FAILED: Missing prompt`);
      throw new AppError("Missing required job data: prompt", 400);
    }

    console.log(`✅ Starting story processing for jobId: ${jobData.jobId}`);
  }

  private async generateStory(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<{
    story: IStoryResponse;
    seedreamPrompt: string;
    toVoiceGenerationText: string;
  }> {
    const openAIService = new OpenAIService();

    try {
      const story: IStoryResponse = {
        title: jobData.title || await openAIService.generateTitle(jobData.prompt, jobData.voiceOver?.voiceLanguage || "English"),
        scenes: Array.from({ length: jobData.numOfScenes }, (_, i) => {
          return {
            sceneNumber: i + 1,
            sceneDescription: null,
            image: null,
            videoDescription: null,
            imageDescription: null,
            narration: null,
            scenePrompt: null,
          };
        }),
      };

      console.log("🎯 Generating Seedream prompt...");
      const { narrativeText: seedreamPrompt, toVoiceGenerationText } =
        await openAIService.generateSeedreamPrompt(
          jobData.prompt,
          jobData.numOfScenes,
          jobData.style,
          jobData.genere,
          jobData.location
        );
      console.log(
        `✅ Story generated successfully with ${story.scenes.length} scenes`
      );
      return { story, seedreamPrompt, toVoiceGenerationText };
    } catch (openAIError) {
      console.error("❌ OpenAI service error:", openAIError);
      throw new AppError("Failed to generate story scenes with OpenAI", 500);
    }
  }

  private async generateVideos(
    job: Job,
    imageUrls: string[]
  ): Promise<{ video: string; PID: string }[]> {
    console.log(
      "🎬 Generating videos from images using parallel processing..."
    );

    try {
      // Use the new optimized parallel video generation
      const videoUrls =
        await this.videoGenerationService.generateVideosParallel(imageUrls);

      if (!videoUrls || videoUrls.length !== imageUrls.length) {
        throw new AppError(
          `Failed to generate videos. Expected: ${imageUrls.length}, Got: ${
            videoUrls?.length || 0
          }`,
          500
        );
      }

      console.log(
        `✅ Successfully generated ${videoUrls.length} videos in parallel`
      );
      const videosWithSFX = await this.sfxService.generateSFXForVideos(
        videoUrls
      );
      //? Cloudinary Uploads
      let returnedVideosUrls: string[] = [];
      const uploadPromises = videosWithSFX.map(async (url, index) => {
        const videoHash = randomBytes(8).toString("hex");
        const result = await cloudUploadURL(
          url,
          `user_${job.data.userId}/${CLOUDINAT_FOLDERS.PROCESSING_VIDEOS}`,
          videoHash,
          "video"
        );
        returnedVideosUrls[index] = result.secure_url;
        return result;
      });
      const results = await Promise.all<UploadApiResponse>(uploadPromises);
      const videosUrls = results.map((result) => {
        return {
          video: result.secure_url,
          PID: result.public_id,
        };
      });

      return videosUrls;
    } catch (videoGenError) {
      console.error("❌ Parallel video generation error:", videoGenError);

      // Fallback to sequential processing if parallel fails
      console.log("🔄 Falling back to sequential video generation...");
      try {
        const fallbackVideoUrls =
          await this.videoGenerationService.generateVideos(imageUrls);

        console.log(
          `✅ Sequential fallback completed: ${fallbackVideoUrls.length} videos`
        );

        //? Cloudinary Uploads
        const uploadPromises: Promise<UploadApiResponse>[] =
          fallbackVideoUrls.map(async (url, index) => {
            const videoHash = randomBytes(8).toString("hex");
            return await cloudUploadURL(
              url,
              `user_${job.data.userId}/${CLOUDINAT_FOLDERS.PROCESSING_VIDEOS}`,
              videoHash,
              "video"
            );
          });
        const results = await Promise.all<UploadApiResponse>(uploadPromises);
        const videosUrls = results.map((result) => {
          return {
            video: result.secure_url,
            PID: result.public_id,
          };
        });

        return videosUrls;
      } catch (fallbackError) {
        console.error("❌ Sequential fallback also failed:", fallbackError);
        throw new AppError(
          "Failed to generate videos (both parallel and sequential methods failed)",
          500
        );
      }
    }
  }

  private async mergeAndComposeVideo(
    job: Job,
    videoUrls: { video: string; PID: string }[],
    voiceOver: IProcessedVoiceOver | null,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<Buffer | string> {
    console.log("🎞️ Merging video scenes...");

    try {
      // Merge video scenes
      const mergedVideo =
        await this.videoGenerationService.mergeScenesWithCloudinary(
          videoUrls,
          jobData.userId
        );

      if (voiceOver && voiceOver.url) {
        console.log("🎵 Composing video with voice over...");

        const composedURL =
          await this.videoGenerationService.composeSoundWithCloudinary(
            mergedVideo,
            voiceOver.PID as string
          );
        const hashedVideoId = `merged_video_${Date.now()}`;
        const uploadResult = await cloudUploadURL(
          composedURL,
          `user_${jobData.userId}/${CLOUDINAT_FOLDERS.GENERATED_VIDEOS}`,
          hashedVideoId
        );
        return uploadResult.secure_url;
      } else {
        console.log("⏭️ Skipping audio composition - no voice over provided");
      }

      return mergedVideo.video;
    } catch (mergeError) {
      console.error("❌ Video merge/composition error:", mergeError);
      throw new AppError(
        `Failed to merge/compose video: ${
          mergeError instanceof Error ? mergeError.message : "Unknown error"
        }`,
        500
      );
    }
  }
  async uploadVideo(
    job: Job,
    videoBuffer: Buffer,
    jobId: string
  ): Promise<string> {
    try {
      const videoHash = generateHashFromBuffer(videoBuffer);
      const uploadResult = await cloudUploadVideo(
        videoBuffer,
        `user_${job.data.userId}/${CLOUDINAT_FOLDERS.GENERATED_VIDEOS}`,
        videoHash
      );

      if (!uploadResult?.secure_url) {
        throw new AppError("Failed to upload video - no URL returned", 500);
      }

      console.log(`✅ Video uploaded successfully: ${uploadResult.secure_url}`);
      return uploadResult.secure_url;
    } catch (uploadError) {
      throw new AppError("Failed to upload  video to cloud storage", 500);
    }
  }
  private async saveCompletedStory(
    job: Job,
    story: IStoryResponse,
    finalVideoUrl: string,
    voiceOver: IProcessedVoiceOver | null,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<any> {
    console.log("💾 Saving completed story to database...");

    try {
      const storyUpdateData = {
        videoUrl: finalVideoUrl,
        scenes: story.scenes,
        thumbnail: story.scenes[0]?.image || null,
        location: jobData.location || null,
        style: jobData.style || null,
        title: story.title || null,
        genre: jobData.genere || null,
        voiceOver: voiceOver
          ? {
              sound: voiceOver.url,
              text: voiceOver.text,
              voiceAccent: voiceOver.data.voiceAccent || null,
              voiceLanguage: voiceOver.data.voiceLanguage || null,
              voiceGender: voiceOver.data.voiceGender || null,
              voiceOverLyrics: voiceOver.data.voiceOverLyrics || null,
            }
          : null,
        refImage: jobData.image || null,
        credits: jobData.credits,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrationService = RepositoryOrchestrationService.getInstance();
      const updatedStory = await orchestrationService.updateCompletedStory(
        jobData.jobId,
        storyUpdateData
      );

      if (!updatedStory) {
        throw new AppError("Failed to update story in database", 500);
      }

      if (updatedStory && voiceOver) {
        console.log("🔄 Updating complete voice over object in story...");
        await Story.findByIdAndUpdate(updatedStory._id, {
          voiceOver: {
            voiceOverLyrics: voiceOver.data.voiceOverLyrics || null,
            voiceLanguage: voiceOver.data.voiceLanguage || null,
            voiceGender: voiceOver.data.voiceGender || null,
            sound: voiceOver.url,
            text: voiceOver.text,
          },
        });
      } else if (updatedStory && !voiceOver) {
        console.log("🔄 Setting voiceOver field to null...");
        await Story.findByIdAndUpdate(updatedStory._id, {
          voiceOver: null,
        });
      }

      console.log(`✅ Story saved to database with ID: ${updatedStory._id}`);
      return updatedStory;
    } catch (dbError) {
      console.error("❌ Database save error:", dbError);
      throw new AppError("Failed to save completed story to database", 500);
    }
  }
  private updateStoryWithImages(
    story: IStoryResponse,
    imageUrls: string[]
  ): IStoryResponse {
    console.log("🔗 Updating story scenes with generated images...");

    return {
      ...story,
      scenes: story.scenes.map((scene: any, index: number) => ({
        ...scene,
        image: imageUrls[index],
      })),
    };
  }
  private async processVoiceOverWithProgress(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string },
    toVoiceGenerationPrompt: string
  ): Promise<IProcessedVoiceOver | null> {
    if (!jobData.voiceOver) {
      console.log("⏭️ No voice over requested, skipping...");
      return null;
    }

    console.log("🎙️ Processing voice over in parallel...");

    try {
      let voiceOverText: string;

      if (
        jobData.voiceOver.voiceOverLyrics &&
        jobData.voiceOver.voiceOverLyrics !== "null"
      ) {
        voiceOverText = jobData.voiceOver.voiceOverLyrics;
        console.log("📝 Using provided voice over lyrics");
      } else {
        console.log("🤖 Generating narrative text with OpenAI...");
        const openAIService = new OpenAIService();
        const generationInfo = await StoryGenerationInfo.findOne().lean();

        const language = generationInfo?.languages.find(
          (lang: any) =>
            lang._id.toString() === jobData.voiceOver!.voiceLanguage
        );
        let accent: any = null;
        if (jobData.voiceOver!.voiceLanguage && jobData.voiceOver.voiceAccent) {
          accent = language?.accents.find(
            (acc: any) => acc._id.toString() === jobData.voiceOver!.voiceAccent
          );
        }
        voiceOverText = await openAIService.generateNarrativeText(
          toVoiceGenerationPrompt,
          language?.name.split(" ")[1] || "English",
          accent?.name || null,
          jobData.numOfScenes
        );
      }
      logger.info({ voiceOverText });
      // Generate voice over audio
      const voiceOverData = { ...jobData.voiceOver, text: voiceOverText };
      let voiceOverUrl = await this.voiceGenerationService.generateVoiceOver(
        voiceOverData,
        jobData.userId
      );

      if (!voiceOverUrl) {
        throw new AppError("Failed to generate voice over audio", 500);
      }
      return {
        url: voiceOverUrl.url,
        PID: voiceOverUrl.PID,
        text: voiceOverText,
        data: voiceOverData,
      };
    } catch (voiceError) {
      console.error("❌ Voice over generation error:", voiceError);
      throw new AppError("Failed to generate voice over", 500);
    }
  }
  private async generateImagesWithProgress(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string },
    seedreamPrompt: string
  ): Promise<string[]> {
    console.log("🎨 Generating images for story scenes in parallel...");

    try {
      let imageUrls: string[];

      if (!jobData.image) {
        console.log("🖼️ No reference image provided, generating from prompt");
        imageUrls = await this.imageGenerationService.generateSeedreamImages(
          seedreamPrompt,
          jobData.numOfScenes
        );
      } else {
        console.log("🖼️ Using reference image for generation");
        imageUrls = await this.imageGenerationService.generateSeedreamImages(
          seedreamPrompt,
          jobData.numOfScenes,
          [jobData.image]
        );
      }
      // Validate generated images
      if (!imageUrls || imageUrls.length !== jobData.numOfScenes) {
        throw new AppError(
          `Failed to generate required number of images. Expected: ${
            jobData.numOfScenes
          }, Got: ${imageUrls?.length || 0}`,
          500
        );
      }

      const invalidImages = imageUrls.filter(
        (url: string) =>
          !url || typeof url !== "string" || !url.startsWith("http")
      );

      if (invalidImages.length > 0) {
        throw new AppError(
          `Invalid image URLs generated: ${invalidImages.length} out of ${imageUrls.length} images are invalid`,
          500
        );
      }

      console.log(
        `✅ Successfully generated ${imageUrls.length} images in parallel`
      );
      return imageUrls;
    } catch (imageGenError) {
      throw new AppError("Failed to generate images for the story scenes", 500);
    }
  }
}
