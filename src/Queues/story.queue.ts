import Queue from "bull";
import AppError from "../Utils/Errors/AppError";
import { OpenAIService } from "../Services/openAi.service";
import { IStoryProcessingDTO } from "../DTOs/storyRequest.dto";
import { IStoryResponse } from "../Interfaces/storyResponse.interface";
import { updateJobProgress } from "../Utils/Model/model.utils";
import { getIO } from "../Sockets/socket";
import { VideoGenerationService } from "../Services/videoGeneration.service";
import { updateCompletedStory } from "../Utils/Database/optimizedOps";
import Job from "../Models/job.model";
import {
  cloudUploadVideo,
  deleteCloudinaryResource,
} from "../Utils/APIs/cloudinary";
import { StoryDTO } from "../DTOs/story.dto";

const redisPort = (process.env.REDIS_PORT as string)
  ? parseInt(process.env.REDIS_PORT as string, 10)
  : 6379;

export const storyQueue = new Queue("storyProcessing", {
  redis: {
    host: process.env.REDIS_HOST as string,
    port: redisPort,
    password: (process.env.REDIS_PASSWORD as string) || undefined,
  },
  defaultJobOptions: {
    attempts: 2,
    timeout: 300000,
    removeOnComplete: 10, // Keep only 10 completed jobs
    removeOnFail: 5, // Keep only 5 failed jobs
  },
});

storyQueue.process(async (job) => {
  try {
    const jobData: IStoryProcessingDTO & { userId: string; jobId: string } =
      job.data;

    // Validate job data
    if (!jobData.userId || !jobData.jobId) {
      throw new AppError("Missing required job data: userId or jobId", 400);
    }

    if (!jobData.prompt) {
      throw new AppError("Missing required job data: prompt", 400);
    }

    console.log(`Starting story processing for jobId: ${jobData.jobId}`);
    console.log("Job data:", jobData);

    updateJobProgress(
      job,
      10,
      `Generating story with ${jobData.numOfScenes} scenes`,
      getIO(),
      "story:progress"
    );

    const openAIService = new OpenAIService(
      jobData.numOfScenes,
      jobData.title,
      jobData.style,
      jobData.genere,
      jobData.location,
      jobData.voiceOver?.voiceOverLyrics ? false : true
    );

    console.log("Calling OpenAI service to generate scenes...");
    let story: IStoryResponse;
    try {
      story = await openAIService.generateScenes(jobData.prompt);
    } catch (openAIError) {
      console.error("OpenAI service error:", openAIError);
      throw new AppError("Failed to generate story scenes with OpenAI", 500);
    }

    if (
      !story ||
      !story.scenes ||
      story.scenes.length !== jobData.numOfScenes
    ) {
      console.error("Invalid story generated:", {
        hasStory: !!story,
        hasScenes: !!story?.scenes,
        sceneCount: story?.scenes?.length,
        expectedScenes: jobData.numOfScenes,
      });
      throw new AppError(
        "Failed to generate the correct number of story scenes",
        500
      );
    }

    console.log("Story generated successfully:", story);

    updateJobProgress(
      job,
      30,
      `Generating images for the story`,
      getIO(),
      "story:progress"
    );
    // const imageGenerationService = new ImageGenerationService();
    // const imageUrls = await imageGenerationService.generateImagesForScenes(
    //   story.scenes as IScene[]
    // );
    // if (!imageUrls || imageUrls.length !== story.scenes.length) {
    //   throw new AppError("Failed to generate images for the story scenes", 500);
    // }
    const imageUrls = [
      "https://d1q70pf5vjeyhc.cloudfront.net/predictions/3f8a46aff2e24c24b69ca151ddbaacb1/1.png",
      "https://d1q70pf5vjeyhc.cloudfront.net/predictions/6f5ad9ba54004448a22ef6e1ed02decd/1.png",
      "https://d1q70pf5vjeyhc.cloudfront.net/predictions/931765a8b11447e7b922a5cf0b007030/1.png",
    ];
    story.scenes = story.scenes.map((scene, index) => ({
      ...scene,
      image: imageUrls[index] || "",
    }));

    console.log("JOB DATA IMG: \n", imageUrls);
    updateJobProgress(
      job,
      50,
      `Generating video for the story`,
      getIO(),
      "story:progress"
    );

    // story.scenes.forEach((scene, index) => {
    //   scene.image = imageUrls[index];
    // });

    const videoGenerationService = new VideoGenerationService();
    // const videoUrls = await videoGenerationService.generateVideos(
    //   story.scenes as IScene[]
    // );
    // if (!videoUrls || videoUrls.length !== story.scenes.length) {
    //   throw new AppError("Failed to generate videos for the story scenes", 500);
    // }
    // console.log("JOB DATA VIDEOs: \n", videoUrls);
    const videoUrls = [
      "https://d1q70pf5vjeyhc.cloudfront.net/predictions/4616cf5fefc6455a9858e1914f6b2be1/1.mp4",
      "https://d1q70pf5vjeyhc.cloudfront.net/predictions/ebae2df9ad034ae4be9883d1ef9f3c7d/1.mp4",
      "https://d1q70pf5vjeyhc.cloudfront.net/predictions/52544d2b11b3402e9e562811bfd669bf/1.mp4",
    ];

    updateJobProgress(
      job,
      80,
      `Merging video scenes`,
      getIO(),
      "story:progress"
    );

    console.log("Merging video scenes...");
    let mergedVideoBuffer;
    try {
      mergedVideoBuffer = await videoGenerationService.mergeScenes(
        videoUrls as string[]
      );
    } catch (mergeError) {
      console.error("Video merge error:", mergeError);
      throw new AppError("Failed to merge video scenes", 500);
    }

    if (!mergedVideoBuffer) {
      throw new AppError(
        "Failed to merge video scenes - no buffer returned",
        500
      );
    }

    console.log(
      "Video scenes merged successfully, buffer size:",
      mergedVideoBuffer.length
    );
    let finalVideoBuffer = mergedVideoBuffer;

    //Starting Voice Over
    let voiceOverUrl =
      "https://res.cloudinary.com/dggkd3bfz/video/upload/v1757442453/pu3strlgov6fn4b8wfyz.mp3";
    if (jobData.voiceOver) {
      updateJobProgress(
        job,
        90,
        `Generating voice over for the story`,
        getIO(),
        "story:progress"
      );
      console.log("Processing voice over...");
      const voiceOverNarration = story.scenes
        .map((scene) => scene.narration)
        .join(" ");
      jobData.voiceOver.text = voiceOverNarration;
      jobData.voiceOver.sound = voiceOverUrl;
      // const voiceOverService = new VoiceGenerationService();
      // voiceOverUrl = await voiceOverService.generateVoiceOver(
      //   jobData.voiceOver,
      //   voiceOverNarration
      // );
    }
    console.log("Voice Over URL: ", voiceOverUrl);

    // First, upload the merged video to get a URL for voice composition
    let mergedVideoUrl = "";
    if (jobData.voiceOver && voiceOverUrl) {
      updateJobProgress(
        job,
        92,
        `Uploading video for voice composition`,
        getIO(),
        "story:progress"
      );

      const tempUploadResult = await cloudUploadVideo(
        finalVideoBuffer,
        `temp_story_videos/${jobData.jobId}_temp`
      );
      mergedVideoUrl = tempUploadResult.secure_url;
    }

    if (jobData.voiceOver && voiceOverUrl && mergedVideoUrl) {
      updateJobProgress(
        job,
        95,
        `Composing video with sound`,
        getIO(),
        "story:progress"
      );

      console.log("Composing video with sound...");
      try {
        finalVideoBuffer = await videoGenerationService.composeSoundWithVideo(
          mergedVideoUrl,
          voiceOverUrl
        );
      } catch (composeError) {
        console.error("Video composition error:", composeError);
        throw new AppError("Failed to compose video with voice over", 500);
      }

      if (!finalVideoBuffer) {
        throw new AppError(
          "Failed to compose video with voice over - no buffer returned",
          500
        );
      }
      console.log(
        "Video composed with sound successfully, buffer size:",
        finalVideoBuffer.length
      );
    }

    // Upload final video to Cloudinary
    updateJobProgress(
      job,
      98,
      `Uploading final video`,
      getIO(),
      "story:progress"
    );

    const finalVideoUrl = (
      await cloudUploadVideo(finalVideoBuffer, `story_videos/${jobData.jobId}`)
    ).secure_url;

    // Clean up temporary video upload if it exists
    if (mergedVideoUrl && jobData.voiceOver) {
      try {
        await deleteCloudinaryResource(
          `temp_story_videos/${jobData.jobId}_temp`,
          "video"
        );
        console.log("Temporary video upload cleaned up");
      } catch (cleanupError) {
        console.warn(
          "Failed to clean up temporary video upload:",
          cleanupError
        );
      }
    }

    console.log("Final video URL: ", finalVideoUrl);
    updateJobProgress(
      job,
      100,
      `Story processing completed`,
      getIO(),
      "story:completed"
    );

    // Update the existing story with completed data
    console.log("Updating story in database...");
    const updatedStory = await updateCompletedStory(job.opts.jobId as string, {
      videoUrl: finalVideoUrl,
      scenes: story.scenes,
      thumbnail: story.scenes[0]?.image || jobData.image || "",
      location: jobData.location || undefined,
      style: jobData.style || undefined,
      title: story.title || undefined,
      genre: jobData.genere || undefined,
      voiceOver: voiceOverUrl
        ? {
            sound: voiceOverUrl,
            text: jobData.voiceOver?.text || "",
          }
        : undefined,
    });

    console.log("Story updated in database:", updatedStory?._id);

    return {
      finalVideoUrl,
      storyId: updatedStory?._id,
      story: updatedStory,
    };
  } catch (err) {
    console.error("Error in story processing:", err);
    console.error("Job data:", job.data);
    console.error("Job options:", job.opts);
    console.error("Full error details:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      jobId: job.opts.jobId,
    });

    if (job.opts.jobId) {
      try {
        await Job.findOneAndUpdate(
          { jobId: job.opts.jobId as string },
          { status: "failed", updatedAt: new Date() }
        );

        const Story = require("../Models/story.model").default;
        await Story.findOneAndUpdate(
          { jobId: job.opts.jobId as string },
          { status: "failed", updatedAt: new Date() }
        );

        console.log(
          `Updated job and story status to failed for jobId: ${job.opts.jobId}`
        );
      } catch (updateError) {
        console.error("Failed to update failed job/story status:", updateError);
      }
    }

    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    throw new AppError(`Story processing failed: ${errorMessage}`, 500);
  }
});

storyQueue.on("completed", (job, result) => {
  console.log(`Story job with ID ${job.id} has been completed.`);
  console.log("Result:", result);
  const io = getIO();
  if (job.data.userId) {
    const roomName = `user:${job.data.userId}`;
    console.log(`📤 Sending completion notification to room: ${roomName}`);
    io.to(roomName).emit("story:completed", {
      message: "Your story has been generated successfully!",
      story: StoryDTO.toDTO(result),
      jobId: job.opts.jobId,
    });
  }
  job.remove();
});

storyQueue.on("failed", async (job, err) => {
  console.log(`Story job with ID ${job?.id} has failed.`);
  console.log("Error:", err);

  // Update job status to failed in database
  if (job?.opts?.jobId) {
    try {
      await Job.findOneAndUpdate(
        { jobId: job.opts.jobId as string }, 
        {
          status: "failed",
          updatedAt: new Date(),
        }
      );

      // Also update the story status to failed
      const Story = require("../Models/story.model").default;
      await Story.findOneAndUpdate(
        { jobId: job.opts.jobId as string },
        { status: "failed", updatedAt: new Date() }
      );
    } catch (dbErr) {
      console.error("Failed to update job/story status in database:", dbErr);
    }
  }

  // Send notification to user about story failure
  const io = getIO();
  if (job?.data?.userId) {
    const roomName = `user:${job.data.userId}`;
    console.log(`📤 Sending failure notification to room: ${roomName}`);
    io.to(roomName).emit("story:failed", {
      message: "Story generation failed. Please try again.",
      jobId: job.opts?.jobId,
      error: err.message,
    });
  }
});

export default storyQueue;
