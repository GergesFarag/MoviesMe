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
import Story from "../Models/story.model";
import {
  cloudUploadVideo,
  deleteCloudinaryResource,
} from "../Utils/APIs/cloudinary";
import { StoryDTO } from "../DTOs/story.dto";
import { sendNotificationToClient } from "../Utils/Notifications/notifications";
import User from "../Models/user.model";
import { ImageGenerationService } from "../Services/imageGeneration.service";
import { IScene } from "../Interfaces/scene.interface";
import { VoiceGenerationService } from "../Services/voiceGeneration.service";

const redisPort = (process.env.REDIS_PORT as string)
  ? parseInt(process.env.REDIS_PORT as string, 10)
  : 6379;

export const storyQueue = new Queue("storyProcessing", {
  redis: {
    host: process.env.REDIS_HOST as string,
    port: redisPort,
    password: (process.env.REDIS_PASSWORD as string) || undefined,
    maxRetriesPerRequest: 3,
  },
  defaultJobOptions: {
    timeout: 300000,
    removeOnComplete: 10,
    removeOnFail: 5,
  },
  settings: {
    stalledInterval: 30000,
  },
});

storyQueue.process(async (job) => {
  let story: IStoryResponse;
  let imageUrls: string[] = [];

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

    // Check if job already exists and is completed or failed
    const existingJob = await Job.findOne({ jobId: jobData.jobId });
    if (existingJob) {
      if (existingJob.status === "completed") {
        console.log(`Job ${jobData.jobId} already completed, skipping`);
        return { message: "Job already completed", jobId: jobData.jobId };
      }
      if (existingJob.status === "failed") {
        console.log(`Job ${jobData.jobId} already failed, not retrying`);
        throw new AppError("Job already failed and retries are disabled", 400);
      }
    }

    const existingStory = await Story.findOne({ jobId: jobData.jobId });
    if (existingStory) {
      if (existingStory.status === "completed") {
        console.log(`Story ${jobData.jobId} already completed, skipping`);
        return { message: "Story already completed", jobId: jobData.jobId };
      }
      if (existingStory.status === "failed") {
        console.log(`Story ${jobData.jobId} already failed, not retrying`);
        throw new AppError("Story already failed and retries are disabled", 400);
      }
    }

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

    let voiceOverUrl = "";
    let voiceOverText = "";

    if (jobData.voiceOver) {
      console.log("Processing voice over...");
      const voiceOverNarration = story.scenes
        .map((scene) => scene.narration)
        .join(" ");

      voiceOverText = jobData.voiceOver.voiceOverLyrics || voiceOverNarration;
      jobData.voiceOver.text = voiceOverText;
      jobData.voiceOver.sound = voiceOverUrl;
      const voiceOverService = new VoiceGenerationService();
      voiceOverUrl = await voiceOverService.generateVoiceOver(
        jobData.voiceOver,
        voiceOverNarration
      );
    }
    console.log("Voice over URL:", voiceOverUrl);
    updateJobProgress(
      job,
      30,
      `Generating images for the story`,
      getIO(),
      "story:progress"
    );

    const imageGenerationService = new ImageGenerationService(true);

    if (jobData.image) {
      console.log("Using provided reference image for scene generation");
      imageUrls = await imageGenerationService.generateImagesForScenes(
        story.scenes as IScene[],
        jobData.image,
        false
      );
    } else {
      console.log("Generating first image from description, then using it as reference");
      const firstRefImage =
        await imageGenerationService.generateImageFromDescription(
          story.scenes[0].imageDescription
        );

      if (!firstRefImage) {
        throw new AppError("Failed to generate first reference image", 500);
      }

      imageUrls = await imageGenerationService.generateImagesForScenes(
        story.scenes as IScene[],
        firstRefImage,
        true
      );
    }

    // Validate image generation results
    if (!imageUrls || imageUrls.length !== story.scenes.length) {
      throw new AppError(
        `Failed to generate images for the story scenes. Expected ${story.scenes.length} images, got ${imageUrls?.length || 0}`,
        500
      );
    }

    const invalidImages = imageUrls.filter(
      (url, index) => !url || typeof url !== "string" || !url.startsWith("http")
    );

    if (invalidImages.length > 0) {
      throw new AppError(
        `Invalid image URLs generated: ${invalidImages.length} out of ${imageUrls.length} images are invalid`,
        500
      );
    }

    story.scenes = story.scenes.map((scene, index) => ({
      ...scene,
      image: imageUrls[index],
    }));

    console.log("Successfully generated images for all scenes:", imageUrls);
    updateJobProgress(
      job,
      50,
      `Generating video for the story`,
      getIO(),
      "story:progress"
    );
    
    story.scenes.forEach((scene, index) => {
      scene.image = imageUrls[index];
    });

    const videoGenerationService = new VideoGenerationService();
    const videoUrls = await videoGenerationService.generateVideos(
      story.scenes as IScene[]
    );
    if (!videoUrls || videoUrls.length !== story.scenes.length) {
      throw new AppError("Failed to generate videos for the story scenes", 500);
    }
    console.log("JOB DATA VIDEOs: \n", videoUrls);

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
      // Validate video URLs before merging
      if (!videoUrls || videoUrls.length === 0) {
        throw new AppError("No video URLs available for merging", 500);
      }

      // Check if all URLs are valid
      const invalidUrls = videoUrls.filter(
        (url) => !url || typeof url !== "string" || !url.startsWith("http")
      );
      if (invalidUrls.length > 0) {
        throw new AppError(
          `Invalid video URLs found: ${invalidUrls.length} invalid URLs`,
          500
        );
      }

      console.log(`Merging ${videoUrls.length} video scenes:`, videoUrls);
      mergedVideoBuffer = await videoGenerationService.mergeScenes(
        videoUrls as string[]
      );
    } catch (mergeError) {
      console.error("Video merge error:", mergeError);
      throw new AppError(
        `Failed to merge video scenes: ${
          mergeError instanceof Error ? mergeError.message : "Unknown error"
        }`,
        500
      );
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

    // Compose video with sound directly using buffer (no upload needed)
    if (jobData.voiceOver && voiceOverUrl) {
      updateJobProgress(
        job,
        95,
        `Composing video with sound`,
        getIO(),
        "story:progress"
      );

      console.log("🎵 Starting audio composition...");
      console.log("Video buffer size:", finalVideoBuffer.length);
      console.log("Audio URL:", voiceOverUrl);
      console.log(
        "Voice over text preview:",
        voiceOverText?.substring(0, 200) + "..."
      );

      try {
        // Validate audio URL
        if (!voiceOverUrl || !voiceOverUrl.startsWith("http")) {
          throw new AppError("Invalid audio URL for composition", 500);
        }

        // Ensure we have text (use fallback if needed)
        if (!voiceOverText) {
          voiceOverText = story.scenes
            .map((scene) => scene.narration)
            .join(" ");
        }

        console.log("🎬 Calling composeSoundWithVideoBuffer...");
        const composedBuffer =
          await videoGenerationService.composeSoundWithVideoBuffer(
            finalVideoBuffer,
            voiceOverUrl
          );

        if (!composedBuffer || composedBuffer.length === 0) {
          throw new AppError("Audio composition returned empty buffer", 500);
        }

        finalVideoBuffer = composedBuffer;
        console.log(
          "✅ Audio composition successful! New buffer size:",
          finalVideoBuffer.length
        );
      } catch (composeError) {
        console.error("❌ Video composition error:", composeError);
        throw new AppError(
          `Failed to compose video with voice over: ${
            composeError instanceof Error
              ? composeError.message
              : "Unknown error"
          }`,
          500
        );
      }

      console.log(
        "🎉 Video composed with sound successfully, final buffer size:",
        finalVideoBuffer.length
      );
    } else {
      console.log("⚠️ Skipping audio composition - missing requirements:", {
        hasVoiceOver: !!jobData.voiceOver,
        hasVoiceOverUrl: !!voiceOverUrl,
        hasVoiceOverText: !!voiceOverText,
      });
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

    console.log("Final video URL: ", finalVideoUrl);
    updateJobProgress(
      job,
      100,
      `Story processing completed`,
      getIO(),
      "story:completed"
    );

    console.log("Updating story in database...");
    const updatedStory = await updateCompletedStory(job.opts.jobId as string, {
      videoUrl: finalVideoUrl,
      scenes: story.scenes,
      thumbnail: story.scenes[0]?.image || null,
      location: jobData.location || null,
      style: jobData.style || null,
      title: story.title || null,
      genre: jobData.genere || null,
      voiceOver:
        voiceOverUrl && voiceOverText
          ? {
              sound: voiceOverUrl,
              text: voiceOverText,
            }
          : null,
    });

    if (updatedStory && jobData.voiceOver && voiceOverUrl && voiceOverText) {
      console.log("Updating complete voice over object in story...");
      await Story.findByIdAndUpdate(updatedStory._id, {
        voiceOver: {
          voiceOverLyrics: jobData.voiceOver.voiceOverLyrics || null,
          voiceLanguage: jobData.voiceOver.voiceLanguage || null,
          voiceGender: jobData.voiceOver.voiceGender || null,
          sound: voiceOverUrl,
          text: voiceOverText,
        },
      });
      console.log("Complete voice over object updated in database");
    } else if (updatedStory && !jobData.voiceOver) {
      // Explicitly set voiceOver to null if no voice over was requested
      console.log(
        "No voice over requested, ensuring voiceOver field is null..."
      );
      await Story.findByIdAndUpdate(updatedStory._id, {
        voiceOver: null,
      });
    }

    console.log("Story updated in database:", updatedStory?._id);
    console.log("Voice over data saved:", {
      hasVoiceOver: !!jobData.voiceOver,
      sound: voiceOverUrl,
      text: voiceOverText ? voiceOverText.substring(0, 100) + "..." : "No text",
    });

    return {
      finalVideoUrl,
      storyId: updatedStory?._id,
      story: updatedStory,
    };
  } catch (err: any) {
    console.error("Error in story processing:", err);

    updateJobProgress(
      job,
      0,
      `Story processing failed: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
      getIO(),
      "story:failed"
    );

    throw err;
  }
}
);

storyQueue.on("completed", async (job, result) => {
  console.log(`Story job with ID ${job.id} has been completed.`);
  console.log("Result:", result);
  const io = getIO();
  if (job.data.userId) {
    const roomName = `user:${job.data.userId}`;
    console.log(`📤 Sending completion notification to room: ${roomName}`);

    const story = result?.story;
    if (!story) {
      console.error("❌ No story found in result object:", result);
      io.to(roomName).emit("story:failed", {
        message: "Story generation completed but no story data found",
        jobId: job.opts.jobId,
        error: "Missing story data in result",
      });
      return;
    }

    // Ensure scenes array exists and is valid
    if (!story.scenes || !Array.isArray(story.scenes)) {
      console.error("❌ Story scenes are missing or invalid:", story);
      io.to(roomName).emit("story:failed", {
        message: "Story scenes data is invalid",
        jobId: job.opts.jobId,
        error: "Invalid scenes data",
      });
      return;
    }

    try {
      const storyDTO = StoryDTO.toDTO(story);
      io.to(roomName).emit("story:completed", {
        message: "Your story has been generated successfully!",
        story: storyDTO,
        jobId: job.opts.jobId,
        finalVideoUrl: result.finalVideoUrl,
        storyId: result.storyId,
      });
    } catch (dtoError) {
      console.error("❌ Error converting story to DTO:", dtoError);
      io.to(roomName).emit("story:failed", {
        message: "Story generation completed but failed to format response",
        jobId: job.opts.jobId,
        error:
          dtoError instanceof Error
            ? dtoError.message
            : "DTO conversion failed",
      });
    }
  }
  const notificationDTO = {
    storyId: String(result.storyId || null),
    jobId: String(job.opts.jobId || null),
    status: String(result.story.status || null),
    userId: String(job.data.userId || null),
  };
  const user = await User.findById(job.data.userId);

  try {
    const userFCMToken = user?.FCMToken!;
    const res = await sendNotificationToClient(
      userFCMToken,
      "Model Processing Completed",
      `Your video generated successfully`,
      {
        ...notificationDTO,
        redirectTo: "/storyDetails",
      }
    );
    if (res) {
      user?.notifications?.push({
        title: "Model Processing Completed",
        message: `Your video generated successfully`,
        data: notificationDTO,
        redirectTo: "/storyDetails",
        createdAt: new Date(),
      });
      await user?.save();
      console.log("Push notification sent and saved to user notifications");
    }
  } catch (notificationError) {
    console.error("Failed to send push notification:", notificationError);
    // Still save the notification to user's database even if push fails
    if (user) {
      user.notifications?.push({
        title: "Model Processing Completed",
        message: `Your video generated successfully`,
        data: notificationDTO,
        redirectTo: "/storyDetails",
        createdAt: new Date(),
      });
      await user.save();
      console.log(
        "Notification saved to user DB despite push notification failure"
      );
    }
  }
  job.remove();
});

storyQueue.on("failed", async (job, err) => {
  console.log(`Story job with ID ${job?.id} has failed - NO RETRIES.`);
  console.log("Error:", err);
  
  // Since retries are disabled, immediately handle the failure
  console.log("Processing final failure - sending notifications and updating database");

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

      const Story = require("../Models/story.model").default;
      await Story.findOneAndUpdate(
        { jobId: job.opts.jobId as string },
        {
          status: "failed",
          title: "Failed Story Generation!",
          updatedAt: new Date(),
        }
      );

      console.log(
        `Updated job and story status to failed for jobId: ${job.opts.jobId}`
      );
    } catch (dbErr) {
      console.error("Failed to update job/story status in database:", dbErr);
    }
  }

  // Send socket notification
  const io = getIO();
  if (job?.data?.userId) {
    try {
      const roomName = `user:${job.data.userId}`;
      console.log(`📤 Sending failure notification to room: ${roomName}`);
      io.to(roomName).emit("story:failed", {
        message: "Story generation failed. Please try again.",
        jobId: job.opts?.jobId,
        error: err.message,
      });
    } catch (socketError) {
      console.error("Failed to send socket notification:", socketError);
    }
  }

  // Send push notification
  if (job?.data?.userId) {
    try {
      const notificationDTO = {
        storyId: String(job.data.storyId || null),
        jobId: String(job.opts.jobId || null),
        status: "failed",
        userId: String(job.data.userId || null),
      };
      const user = await User.findById(job.data.userId);

      if (user && user.FCMToken) {
        const res = await sendNotificationToClient(
          user.FCMToken,
          "Story Processing Failed",
          `Your video failed to generate`,
          {
            ...notificationDTO,
            redirectTo: "/storyDetails",
          }
        );

        if (res) {
          user.notifications?.push({
            title: "Story Processing Failed",
            message: `Your video failed to generate.`,
            data: notificationDTO,
            redirectTo: "/storyDetails",
            createdAt: new Date(),
          });
          await user.save();
          console.log("Failed story notification saved to user DB");
        }
      } else if (user) {
        // Save notification even if no FCM token
        user.notifications?.push({
          title: "Story Processing Failed",
          message: `Your video failed to generate.`,
          data: notificationDTO,
          redirectTo: "/storyDetails",
          createdAt: new Date(),
        });
        await user.save();
        console.log(
          "Failed story notification saved to user DB (no FCM token)"
        );
      }
    } catch (notificationError) {
      console.error("Failed to send push notification:", notificationError);
      // Don't let notification failures crash the system
    }
  }
});

storyQueue.on("stalled", (job) => {
  console.warn(`⚠️ Job ${job.id} stalled - retries disabled`);
});

storyQueue.on("error", (error) => {
  console.error("❌ Queue error:", error);
  // Prevent queue errors from crashing the server
  try {
    // Log additional context if available
    console.error("Queue error details:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  } catch (logError) {
    console.error("Failed to log queue error details:", logError);
  }
});

setInterval(async () => {
  try {
    const waiting = await storyQueue.getWaiting();
    const active = await storyQueue.getActive();
    const completed = await storyQueue.getCompleted();
    const failed = await storyQueue.getFailed();

    console.log(
      `📈 Queue Stats - Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}`
    );
  } catch (error) {
    console.error("Failed to get queue statistics:", error);
  }
}, 45000);

export default storyQueue;
