import { Job } from 'bull';
import { IStoryProcessingDTO } from '../../DTOs/storyRequest.dto';
import JobModel from '../../Models/job.model';
import Story from '../../Models/story.model';
import AppError from '../../Utils/Errors/AppError';
import { ImageGenerationService } from '../imageGeneration.service';
import { OpenAIService } from '../openAi.service';
import { VideoGenerationService } from '../videoGeneration.service';
import { VoiceGenerationService } from '../voiceGeneration.service';
import { getIO } from '../../Sockets/socket';
import { updateJobProgress } from '../../Utils/Model/model.utils';
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

export const PROGRESS_STEPS = {
  VALIDATION: 10,
  STORY_GENERATION: 30,
  VOICE_OVER: 45,
  IMAGE_GENERATION: 60,
  VIDEO_GENERATION: 80,
  VIDEO_MERGE: 85,
  VIDEO_UPLOAD: 95,
  COMPLETION: 100,
} as const;

export const QUEUE_EVENTS = {
  STORY_PROGRESS: 'story:progress',
  STORY_COMPLETED: 'story:completed',
  STORY_FAILED: 'story:failed',
} as const;

export class StoryProcessorService {
  private imageGenerationService: ImageGenerationService;
  private videoGenerationService: VideoGenerationService;
  private voiceGenerationService: VoiceGenerationService;
  private counter: number = 0;
  constructor() {
    this.imageGenerationService = new ImageGenerationService(true);
    this.videoGenerationService = new VideoGenerationService();
    this.voiceGenerationService = new VoiceGenerationService();
  }
  public async processStory(
    job: Job,
    jobData: IStoryProcessingDTO & { userId: string; jobId: string }
  ): Promise<StoryProcessingResult> {
    const storyInterval = setInterval(() => {
      this.counter += 1;
      if (this.counter > 99) this.counter = 98;
      updateJobProgress(
        job,
        this.counter,
        `Processing story...`,
        getIO(),
        QUEUE_EVENTS.STORY_PROGRESS
      );
    }, 3000);
    try {
      console.log(
        `🚀 Starting story processing for job ${job.id} with jobId: ${jobData.jobId}`
      );

      await this.validateJobData(job, jobData);

      const existingResult = await this.checkExistingJob(jobData.jobId);
      if (existingResult) {
        return existingResult;
      }

      const { story, seedreamPrompt, toVoiceGenerationText } =
        await this.generateStory(job, jobData);
      console.log(
        '🚀 Starting parallel processing: Voice Over + Image Generation'
      );
      logger.info({ seedreamPrompt });
      let [voiceOver, imageUrls]: [
        IProcessedVoiceOver | null,
        string[] | null
      ] = [null, null];

      if (jobData.voiceOver) {
        [voiceOver, imageUrls] = await Promise.all([
          this.processVoiceOverWithProgress(
            job,
            jobData,
            toVoiceGenerationText
          ),
          this.generateImagesWithProgress(job, jobData, seedreamPrompt),
        ]);
      } else {
        imageUrls = await this.generateImagesWithProgress(
          job,
          jobData,
          seedreamPrompt
        );
      }
      console.log(
        '✅ Parallel processing completed: Voice Over + Image Generation'
      );
      const updatedStory = this.updateStoryWithImages(story, imageUrls ?? []);
      const videoUrls = await this.generateVideos(job, imageUrls ?? []);
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

      const finalVideoBuffer = await this.mergeAndComposeVideo(
        job,
        videoUrls,
        voiceOver,
        jobData
      );

      const finalVideoUrl = await this.uploadVideo(
        job,
        finalVideoBuffer,
        jobData.jobId
      );

      const completedStory = await this.saveCompletedStory(
        job,
        updatedStory,
        finalVideoUrl,
        voiceOver,
        jobData
      );

      console.log(
        `✅ Story processing completed successfully for jobId: ${jobData.jobId}`
      );
      if (storyInterval) {
        updateJobProgress(
          job,
          100,
          `Processing story...`,
          getIO(),
          QUEUE_EVENTS.STORY_PROGRESS
        );
        clearInterval(storyInterval);
        this.counter = 0;
      }
      return {
        finalVideoUrl,
        story: completedStory,
      };
    } catch (error) {
      if (storyInterval) {
        clearInterval(storyInterval);
        this.counter = 0;
      }
      console.error(
        `❌ Story processing failed for jobId: ${jobData.jobId}`,
        error
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

  private async checkExistingJob(jobId: string): Promise<any> {
    const existingJob = await JobModel.findOne({ jobId });
    if (existingJob) {
      console.log(`🔍 EXISTING JOB FOUND: Status = ${existingJob.status}`);
      if (existingJob.status === 'completed') {
        console.log(`⏭️ Job ${jobId} already completed, skipping`);
        return { message: 'Job already completed', jobId };
      }
    } else {
      console.log(`🆕 No existing job found, proceeding with new processing`);
    }

    const existingStory = await Story.findOne({ jobId });
    if (existingStory) {
      console.log(`🔍 EXISTING STORY FOUND: Status = ${existingStory.status}`);
      if (existingStory.status === 'completed') {
        console.log(`⏭️ Story ${jobId} already completed, skipping`);
        return { message: 'Story already completed', jobId };
      }
    }
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
        updateJobProgress(
          job,
          PROGRESS_STEPS.IMAGE_GENERATION,
          'Retrying with sequential video generation',
          getIO(),
          QUEUE_EVENTS.STORY_PROGRESS
        );

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
        updateJobProgress(
          job,
          PROGRESS_STEPS.VIDEO_MERGE,
          'Composing video with sound',
          getIO(),
          QUEUE_EVENTS.STORY_PROGRESS
        );

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
