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
import { title } from "process";

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new AppError(`${operation} timed out after ${timeoutMs}ms`, 408)
          ),
        timeoutMs
      )
    ),
  ]);
};

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
    attempts: 5, // Increased from 2 to 5
    timeout: 300000, // 5 minutes - reduced from 10 minutes
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 10, // Keep only 10 completed jobs
    removeOnFail: 10, // Keep only 10 failed jobs
  },
  settings: {
    stalledInterval: 30000, // Check for stalled jobs every 30s
    maxStalledCount: 1, // Retry stalled jobs once
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
    console.log("Job data:", {
      ...jobData,
      userId: "***",
      prompt: jobData.prompt.substring(0, 100) + "...",
    });

    // Check if job is already being processed (duplicate prevention)
    const existingJob = await Job.findOne({ jobId: jobData.jobId });
    if (existingJob && existingJob.status === "completed") {
      console.log(`Job ${jobData.jobId} already completed, skipping`);
      return { message: "Job already completed", jobId: jobData.jobId };
    }

    updateJobProgress(
      job,
      10,
      `Generating story with ${jobData.numOfScenes} scenes`,
      getIO(),
      "story:progress"
    );

    // const openAIService = new OpenAIService(
    //   jobData.numOfScenes,
    //   jobData.title,
    //   jobData.style,
    //   jobData.genere,
    //   jobData.location,
    //   jobData.voiceOver?.voiceOverLyrics ? false : true
    // );

    console.log("Calling OpenAI service to generate scenes...");
    let story: IStoryResponse;
    // try {
    //   story = await openAIService.generateScenes(jobData.prompt);
    // } catch (openAIError) {
    //   console.error("OpenAI service error:", openAIError);
    //   throw new AppError("Failed to generate story scenes with OpenAI", 500);
    // }
    story = {
      title: "The Mirage's Curse",
      scenes: [
        {
          sceneNumber: 1,
          narration:
            "Under the scorching sun, the guide leads a reluctant treasure hunter through endless dunes, shadows looming ominously.",
          imageDescription:
            "A vast desert landscape with golden dunes, a skilled guide in traditional attire, and a ruthless treasure hunter in tattered clothes.",
          videoDescription:
            "Wide shot of the desert with a steady camera, slowly panning to reveal the characters silhouetted against the sun.",
          sceneDescription:
            "The relentless sun beats down as the guide, weathered yet determined, walks ahead, while the treasure hunter trails closely, eyes glinting with greed.",
        },
        {
          sceneNumber: 2,
          narration:
            "Amidst swirling sands, they encounter a mysterious nomad, whose secrets and wisdom spark distrust and ambition.",
          imageDescription:
            "A cloaked nomad appears at dusk, surrounded by swirling sand, eyes reflecting ancient knowledge and mystery.",
          videoDescription:
            "Close-up of the nomad rising from the shadows, the camera rotates around to capture the intensity of the moment.",
          sceneDescription:
            "The nomad's eerie smile cuts through the twilight, revealing cryptic hints about the oasis that reveals one's deepest fears and desires.",
        },
        {
          sceneNumber: 3,
          narration:
            "As the oasis manifests, each character confronts their inner demons, greed fracturing their fragile trust.",
          imageDescription:
            "A shimmering oasis appears under a starlit sky, revealing distorted reflections of fears and ambitions.",
          videoDescription:
            "The camera zooms into the oasis, focusing on each character's reflection, which morphs into dark, haunting visions.",
          sceneDescription:
            "The oasis pulses with life, water glistening, as shadows of the characters loom over them, revealing what they truly desire and fear.",
        },
      ],
    };
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
      mergedVideoBuffer = await withTimeout(
        videoGenerationService.mergeScenes(videoUrls as string[]),
        20000,
        "Video merging"
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

    //Starting Voice Over
    let voiceOverUrl =
      "https://res.cloudinary.com/dggkd3bfz/video/upload/v1757442453/pu3strlgov6fn4b8wfyz.mp3";
    let voiceOverText = "";

    if (jobData.voiceOver) {
      updateJobProgress(
        job,
        90,
        `Generating voice over for the story`,
        getIO(),
        "story:progress"
      );
      console.log("Processing voice over...");

      // Generate narration text from story scenes
      const voiceOverNarration = story.scenes
        .map((scene) => scene.narration)
        .join(" ");

      // Use provided lyrics if available, otherwise use generated narration
      voiceOverText = jobData.voiceOver.voiceOverLyrics || voiceOverNarration;

      // Update the voiceOver object with the text
      jobData.voiceOver.text = voiceOverText;
      jobData.voiceOver.sound = voiceOverUrl;

      console.log("Voice Over Text: ", voiceOverText);
      console.log("Voice Over Narration: ", voiceOverNarration);

      // const voiceOverService = new VoiceGenerationService();
      // voiceOverUrl = await voiceOverService.generateVoiceOver(
      //   jobData.voiceOver,
      //   voiceOverNarration
      // );
    }
    console.log("Voice Over URL: ", voiceOverUrl);
    console.log("Voice Over Text length: ", voiceOverText?.length || 0);
    console.log("Job Data Voice Over: ", !!jobData.voiceOver);
    console.log(
      "Will compose audio: ",
      !!(jobData.voiceOver && voiceOverUrl && voiceOverText)
    );

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
        const composedBuffer = await withTimeout(
          videoGenerationService.composeSoundWithVideoBuffer(
            finalVideoBuffer,
            voiceOverUrl
          ),
          90000, // 1.5 minutes timeout for audio composition
          "Audio composition"
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
      await withTimeout(
        cloudUploadVideo(finalVideoBuffer, `story_videos/${jobData.jobId}`),
        30000, // 30 seconds timeout for upload
        "Video upload"
      )
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
      thumbnail: story.scenes[0]?.image || null, // Use null instead of empty string fallback
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

    // Update the complete voiceOver object if we have voice over data
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

storyQueue.on("completed", async (job, result) => {
  console.log(`Story job with ID ${job.id} has been completed.`);
  console.log("Result:", result);
  const io = getIO();
  if (job.data.userId) {
    const roomName = `user:${job.data.userId}`;
    console.log(`📤 Sending completion notification to room: ${roomName}`);

    // Fix: Extract the story from the result object and ensure it has scenes
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
        message: "Story generation completed but scenes data is invalid",
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
    storyId: String(result.storyId || ""),
    jobId: String(job.opts.jobId || ""),
    status: String(job.data.status || ""),
    userId: String(job.data.userId || ""),
  };
  const user = await User.findById(job.data.userId);

  try {
    const userFCMToken =
      user?.FCMToken ||
      "d9OD-zNgTcCcGdur0OiHhb:APA91bEPHYY2KcPjqSK3s9-5sUGTd5tff1N65hxm8VHA-jtvmXDcLvMbG3qYEYBSms0N987QvKQsmVYGgnnu-fqajJn71ihzPD_kWqI9auyWTq9eFa8WYxc";
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
        redirectTo: "/storiesDetails",
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

      const Story = require("../Models/story.model").default;
      await Story.findOneAndUpdate(
        { jobId: job.opts.jobId as string },
        {
          status: "failed",
          title: "Failed Story Generation!",
          updatedAt: new Date(),
        }
      );
    } catch (dbErr) {
      console.error("Failed to update job/story status in database:", dbErr);
    }
  }

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

  const notificationDTO = {
    storyId: String(job.data.storyId || ""),
    jobId: String(job.opts.jobId || ""),
    status: String(job.data.status || ""),
    userId: String(job.data.userId || ""),
  };
  const user = await User.findById(job.data.userId);

  try {
    const userFCMToken =
      user?.FCMToken ||
      "d9OD-zNgTcCcGdur0OiHhb:APA91bEPHYY2KcPjqSK3s9-5sUGTd5tff1N65hxm8VHA-jtvmXDcLvMbG3qYEYBSms0N987QvKQsmVYGgnnu-fqajJn71ihzPD_kWqI9auyWTq9eFa8WYxc";
    const res = await sendNotificationToClient(
      userFCMToken,
      "Story Processing Failed",
      `Your video failed to generate`,
      {
        ...notificationDTO,
        redirectTo: "/storyDetails",
      }
    );
    if (res) {
      user?.notifications?.push({
        title: "Story Processing Failed",
        message: `Your video failed to generate.`,
        data: notificationDTO,
        redirectTo: "/storyDetails",
        createdAt: new Date(),
      });
      await user?.save();
      console.log("Failed story notification saved to user DB");
    }
  } catch (notificationError) {
    console.error("Failed to send failure notification:", notificationError);
    // Still save the notification to user's database even if push fails
    if (user) {
      user.notifications?.push({
        title: "Story Processing Failed",
        message: `Your video failed to generate.`,
        data: notificationDTO,
        redirectTo: "/storyDetails",
        createdAt: new Date(),
      });
      await user.save();
      console.log(
        "Failed story notification saved to user DB despite push notification failure"
      );
    }
  }
});

// Enhanced monitoring and logging
storyQueue.on("waiting", (jobId) => {
  console.log(`📋 Job ${jobId} is waiting in queue`);
});

storyQueue.on("active", (job) => {
  console.log(
    `🚀 Job ${job.id} started processing at ${new Date().toISOString()}`
  );
});

storyQueue.on("stalled", (job) => {
  console.warn(`⚠️ Job ${job.id} stalled - will be retried`);
});

storyQueue.on("progress", (job, progress) => {
  console.log(`📊 Job ${job.id} progress: ${progress}%`);
});

storyQueue.on("error", (error) => {
  console.error("❌ Queue error:", error);
});

// Log queue statistics periodically
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
}, 30000); // Log every 30 seconds

export default storyQueue;
