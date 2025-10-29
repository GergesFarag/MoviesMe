import { Job } from 'bull';
import { IStoryProcessingDTO } from '../../DTOs/storyRequest.dto';
import JobModel from '../../Models/job.model';
import Story from '../../Models/story.model';
import AppError from '../../Utils/Errors/AppError';
import { ImageGenerationService } from '../imageGeneration.service';
import { OpenAIService } from '../openAi.service';
import { VideoGenerationService } from '../videoGeneration.service';
import { VoiceGenerationService } from '../voiceGeneration.service';
import { IStoryResponse } from '../../Interfaces/storyResponse.interface';
import { IProcessedVoiceOver } from '../../Interfaces/audioModel.interface';
import { RepositoryOrchestrationService } from '../../Services/repositoryOrchestration.service';
import {
  cloudUploadVideo,
  generateHashFromBuffer,
} from '../../Utils/APIs/cloudinary';
import { StoryProcessingResult } from '../../Interfaces/story.interface';
import StoryGenerationInfo from '../../Models/storyGenerationInfo.model';
import logger from '../../Config/logger';
import { sendWebsocket } from '../../Sockets/socket';

export const QUEUE_EVENTS = {
  STORY_PROGRESS: 'story:progress',
  STORY_COMPLETED: 'story:completed',
  STORY_FAILED: 'story:failed',
} as const;

export class StoryProcessorService {
  private imageGenerationService: ImageGenerationService;
  private videoGenerationService: VideoGenerationService;
  private voiceGenerationService: VoiceGenerationService;
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.imageGenerationService = new ImageGenerationService(true);
    this.videoGenerationService = new VideoGenerationService();
    this.voiceGenerationService = new VoiceGenerationService();
  }

  private startProgressUpdates(
    userId: string,
    jobId: string,
    startProgress: number,
    endProgress: number,
    step: string
  ): void {
    this.stopProgressUpdates(jobId);

    let currentProgress = startProgress;
    const interval = setInterval(() => {
      if (currentProgress < endProgress) {
        currentProgress += 1;

        sendWebsocket(
          QUEUE_EVENTS.STORY_PROGRESS,
          {
            jobId,
            progress: currentProgress,
            step,
            message: `${step}: ${currentProgress}%`,
          },
          `user:${userId}`
        );

        console.log(
          `📊 Progress update sent: ${jobId} - ${step} - ${currentProgress}%`
        );
      }
    }, 3000);

    this.progressIntervals.set(jobId, interval);
  }

  private stopProgressUpdates(jobId: string): void {
    const interval = this.progressIntervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.progressIntervals.delete(jobId);
    }
  }

  private sendProgressUpdate(
    userId: string,
    jobId: string,
    progress: number,
    step: string
  ): void {
    sendWebsocket(
      QUEUE_EVENTS.STORY_PROGRESS,
      {
        jobId,
        progress,
        step,
        message: `${step}: ${progress}%`,
      },
      `user:${userId}`
    );
    console.log(`📊 Progress update: ${jobId} - ${step} - ${progress}%`);
  }

  public async processStory(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<StoryProcessingResult> {
    try {
      console.log(
        `🚀 Starting story processing for job ${job.id} with jobId: ${jobData.jobId}`
      );

      this.sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        0,
        'Starting story processing'
      );

      await this.validateJobData(job, jobData);

      this.startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        0,
        10,
        'Generating story'
      );
      const { story, seedreamPrompt, toVoiceGenerationText } =
        await this.generateStory(job, jobData);
      this.stopProgressUpdates(jobData.jobId);
      this.sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        10,
        'Story generated'
      );

      console.log(
        '🚀 Starting parallel processing: Voice Over + Image Generation'
      );
      logger.info({ seedreamPrompt });
      let [voiceOver, imageUrls]: [
        IProcessedVoiceOver | null,
        string[] | null
      ] = [null, null];

      if (jobData.voiceOver) {
        this.startProgressUpdates(
          jobData.userId,
          jobData.jobId,
          10,
          40,
          'Generating voice over and images'
        );
        [voiceOver, imageUrls] = await Promise.all([
          this.processVoiceOverWithProgress(
            job,
            jobData,
            toVoiceGenerationText
          ),
          this.generateImagesWithProgress(job, jobData, seedreamPrompt),
        ]);
        this.stopProgressUpdates(jobData.jobId);
        this.sendProgressUpdate(
          jobData.userId,
          jobData.jobId,
          40,
          'Voice over and images generated'
        );
      } else {
        this.startProgressUpdates(
          jobData.userId,
          jobData.jobId,
          10,
          35,
          'Generating images'
        );
        imageUrls = await this.generateImagesWithProgress(
          job,
          jobData,
          seedreamPrompt
        );
        this.stopProgressUpdates(jobData.jobId);
        this.sendProgressUpdate(
          jobData.userId,
          jobData.jobId,
          35,
          'Images generated'
        );
      }

      console.log(
        '✅ Parallel processing completed: Voice Over + Image Generation'
      );
      const updatedStory = this.updateStoryWithImages(story, imageUrls ?? []);

      const videoStartProgress = jobData.voiceOver ? 40 : 35;
      const videoEndProgress = jobData.voiceOver ? 70 : 65;
      this.startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        videoStartProgress,
        videoEndProgress,
        'Generating videos'
      );
      const videoUrls = await this.generateVideos(job, imageUrls ?? []);
      this.stopProgressUpdates(jobData.jobId);
      this.sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        videoEndProgress,
        'Videos generated'
      );

      if (jobData.audio) {
        console.log('⏭️ Using provided audio, skipping voice over generation');
        voiceOver = {
          url: jobData.audio,
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
      this.startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        mergeStartProgress,
        mergeEndProgress,
        'Merging and composing video'
      );
      const finalVideoBuffer = await this.mergeAndComposeVideo(
        job,
        videoUrls,
        voiceOver,
        jobData
      );
      this.stopProgressUpdates(jobData.jobId);
      this.sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        mergeEndProgress,
        'Video merged and composed'
      );

      const uploadStartProgress = jobData.voiceOver ? 85 : 80;
      const uploadEndProgress = jobData.voiceOver ? 95 : 90;
      this.startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        uploadStartProgress,
        uploadEndProgress,
        'Uploading video'
      );
      const finalVideoUrl = await this.uploadVideo(
        job,
        finalVideoBuffer,
        jobData.jobId
      );
      this.stopProgressUpdates(jobData.jobId);
      this.sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        uploadEndProgress,
        'Video uploaded'
      );

      // Save to database: 95-100%
      const saveStartProgress = jobData.voiceOver ? 95 : 90;
      this.startProgressUpdates(
        jobData.userId,
        jobData.jobId,
        saveStartProgress,
        99,
        'Saving story'
      );
      const completedStory = await this.saveCompletedStory(
        job,
        updatedStory,
        finalVideoUrl,
        voiceOver,
        jobData
      );
      this.stopProgressUpdates(jobData.jobId);

      this.sendProgressUpdate(
        jobData.userId,
        jobData.jobId,
        100,
        'Story completed'
      );
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

      this.stopProgressUpdates(jobData.jobId);
      sendWebsocket(
        QUEUE_EVENTS.STORY_FAILED,
        {
          jobId: jobData.jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
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
      throw new AppError('Missing required job data: userId or jobId', 400);
    }

    if (!jobData.prompt) {
      console.log(`❌ VALIDATION FAILED: Missing prompt`);
      throw new AppError('Missing required job data: prompt', 400);
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
        title: jobData.title || 'Untitled Story',
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

      console.log('🎯 Generating Seedream prompt...');
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
      console.error('❌ OpenAI service error:', openAIError);
      throw new AppError('Failed to generate story scenes with OpenAI', 500);
    }
  }
  private async generateVideos(
    job: Job,
    imageUrls: string[]
  ): Promise<string[]> {
    console.log(
      '🎬 Generating videos from images using parallel processing...'
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

      const invalidUrls = videoUrls.filter(
        (url: string | null | undefined) =>
          !url || typeof url !== 'string' || !url.startsWith('http')
      );

      if (invalidUrls.length > 0) {
        throw new AppError(
          `Invalid video URLs generated: ${invalidUrls.length} invalid URLs`,
          500
        );
      }

      console.log(
        `✅ Successfully generated ${videoUrls.length} videos in parallel`
      );
      return videoUrls;
    } catch (videoGenError) {
      console.error('❌ Parallel video generation error:', videoGenError);

      // Fallback to sequential processing if parallel fails
      console.log('🔄 Falling back to sequential video generation...');
      try {
        const fallbackVideoUrls =
          await this.videoGenerationService.generateVideos(imageUrls);

        console.log(
          `✅ Sequential fallback completed: ${fallbackVideoUrls.length} videos`
        );
        return fallbackVideoUrls;
      } catch (fallbackError) {
        console.error('❌ Sequential fallback also failed:', fallbackError);
        throw new AppError(
          'Failed to generate videos (both parallel and sequential methods failed)',
          500
        );
      }
    }
  }

  private async mergeAndComposeVideo(
    job: Job,
    videoUrls: string[],
    voiceOver: IProcessedVoiceOver | null,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<Buffer> {
    console.log('🎞️ Merging video scenes...');

    try {
      // Merge video scenes
      const mergedVideoBuffer = await this.videoGenerationService.mergeScenes(
        videoUrls
      );

      if (!mergedVideoBuffer || mergedVideoBuffer.length === 0) {
        throw new AppError(
          'Failed to merge video scenes - no buffer returned',
          500
        );
      }

      let finalVideoBuffer = mergedVideoBuffer;

      // Compose with audio if voice over exists
      if (voiceOver && voiceOver.url) {
        console.log('🎵 Composing video with voice over...');

        const composedBuffer =
          await this.videoGenerationService.composeSoundWithVideoBuffer(
            finalVideoBuffer,
            voiceOver.url,
            jobData.numOfScenes
          );

        if (!composedBuffer || composedBuffer.length === 0) {
          throw new AppError('Audio composition returned empty buffer', 500);
        }

        finalVideoBuffer = composedBuffer;
        console.log(
          `✅ Video composed with sound successfully, buffer size: ${finalVideoBuffer.length}`
        );
      } else {
        console.log('⏭️ Skipping audio composition - no voice over provided');
      }

      return finalVideoBuffer;
    } catch (mergeError) {
      console.error('❌ Video merge/composition error:', mergeError);
      throw new AppError(
        `Failed to merge/compose video: ${
          mergeError instanceof Error ? mergeError.message : 'Unknown error'
        }`,
        500
      );
    }
  }
  private async uploadVideo(
    job: Job,
    videoBuffer: Buffer,
    jobId: string
  ): Promise<string> {
    console.log('☁️ Uploading final video to cloud storage...');

    try {
      const videoHash = generateHashFromBuffer(videoBuffer);
      const uploadResult = await cloudUploadVideo(
        videoBuffer,
        `user_${job.data.userId}/videos/generated`,
        videoHash
      );

      if (!uploadResult?.secure_url) {
        throw new AppError('Failed to upload video - no URL returned', 500);
      }

      console.log(`✅ Video uploaded successfully: ${uploadResult.secure_url}`);
      return uploadResult.secure_url;
    } catch (uploadError) {
      console.error('❌ Video upload error:', uploadError);
      throw new AppError('Failed to upload final video to cloud storage', 500);
    }
  }
  private async saveCompletedStory(
    job: Job,
    story: IStoryResponse,
    finalVideoUrl: string,
    voiceOver: IProcessedVoiceOver | null,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<any> {
    console.log('💾 Saving completed story to database...');

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
      };

      const orchestrationService = RepositoryOrchestrationService.getInstance();
      const updatedStory = await orchestrationService.updateCompletedStory(
        jobData.jobId,
        storyUpdateData
      );

      if (!updatedStory) {
        throw new AppError('Failed to update story in database', 500);
      }

      if (updatedStory && voiceOver) {
        console.log('🔄 Updating complete voice over object in story...');
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
        console.log('🔄 Setting voiceOver field to null...');
        await Story.findByIdAndUpdate(updatedStory._id, {
          voiceOver: null,
        });
      }

      console.log(`✅ Story saved to database with ID: ${updatedStory._id}`);
      return updatedStory;
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
      throw new AppError('Failed to save completed story to database', 500);
    }
  }
  private updateStoryWithImages(
    story: IStoryResponse,
    imageUrls: string[]
  ): IStoryResponse {
    console.log('🔗 Updating story scenes with generated images...');

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
      console.log('⏭️ No voice over requested, skipping...');
      return null;
    }

    console.log('🎙️ Processing voice over in parallel...');

    try {
      let voiceOverText: string;

      if (
        jobData.voiceOver.voiceOverLyrics &&
        jobData.voiceOver.voiceOverLyrics !== 'null'
      ) {
        voiceOverText = jobData.voiceOver.voiceOverLyrics;
        console.log('📝 Using provided voice over lyrics');
      } else {
        console.log('🤖 Generating narrative text with OpenAI...');
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
          language?.name.split(' ')[1] || 'English',
          accent?.name || null,
          jobData.numOfScenes
        );
      }
      logger.info({ voiceOverText });
      // Generate voice over audio
      const voiceOverData = { ...jobData.voiceOver, text: voiceOverText };
      const voiceOverUrl = await this.voiceGenerationService.generateVoiceOver(
        voiceOverData,
        jobData.userId
      );

      if (!voiceOverUrl) {
        throw new AppError('Failed to generate voice over audio', 500);
      }

      console.log(
        `✅ Voice over generated successfully: ${voiceOverUrl.substring(
          0,
          50
        )}...`
      );

      return {
        url: voiceOverUrl,
        text: voiceOverText,
        data: voiceOverData,
      };
    } catch (voiceError) {
      console.error('❌ Voice over generation error:', voiceError);
      throw new AppError('Failed to generate voice over', 500);
    }
  }
  private async generateImagesWithProgress(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string },
    seedreamPrompt: string
  ): Promise<string[]> {
    console.log('🎨 Generating images for story scenes in parallel...');

    try {
      let imageUrls: string[];

      if (!jobData.image) {
        console.log('🖼️ No reference image provided, generating from prompt');
        imageUrls = await this.imageGenerationService.generateSeedreamImages(
          seedreamPrompt,
          jobData.numOfScenes
        );
      } else {
        console.log('🖼️ Using reference image for generation');
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
          !url || typeof url !== 'string' || !url.startsWith('http')
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
      throw new AppError('Failed to generate images for the story scenes', 500);
    }
  }
}
