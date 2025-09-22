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
import { cloudUploadVideo } from "../Utils/APIs/cloudinary";
import { StoryDTO } from "../DTOs/story.dto";
import { sendNotificationToClient } from "../Utils/Notifications/notifications";
import User from "../Models/user.model";
import { ImageGenerationService } from "../Services/imageGeneration.service";
import { VoiceGenerationService } from "../Services/voiceGeneration.service";

const redisPort =
  process.env.NODE_ENV === "production"
    ? process.env.REDIS_PORT
      ? parseInt(process.env.REDIS_PORT)
      : 10711
    : 6379;
const redisHost =
  process.env.NODE_ENV === "production"
    ? (process.env.REDIS_HOST as string)
    : "localhost";
const redisPassword =
  process.env.NODE_ENV === "production"
    ? (process.env.REDIS_PASSWORD as string)
    : undefined;

console.log("Redis Config : ", {
  host: redisHost,
  port: redisPort,
  password: redisPassword ? "******" : undefined,
});
export const storyQueue = new Queue("storyProcessing", {
  redis: {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
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
  let seedreamPrompt = "";
  let imageUrls: string[] = [];

  console.log(
    `🚀 QUEUE ENTRY: Processing job ${job.id} with jobId: ${job.data.jobId}`
  );

  try {
    const jobData: IStoryProcessingDTO & { userId: string; jobId: string } =
      job.data;

    // Validate job data
    if (!jobData.userId || !jobData.jobId) {
      console.log(`❌ VALIDATION FAILED: Missing userId or jobId`);
      throw new AppError("Missing required job data: userId or jobId", 400);
    }

    if (!jobData.prompt) {
      console.log(`❌ VALIDATION FAILED: Missing prompt`);
      throw new AppError("Missing required job data: prompt", 400);
    }

    console.log(`✅ Starting story processing for jobId: ${jobData.jobId}`);

    const existingJob = await Job.findOne({ jobId: jobData.jobId });
    if (existingJob) {
      console.log(`🔍 EXISTING JOB FOUND: Status = ${existingJob.status}`);
      if (existingJob.status === "completed") {
        console.log(`⏭️ Job ${jobData.jobId} already completed, skipping`);
        return { message: "Job already completed", jobId: jobData.jobId };
      }
    } else {
      console.log(`🆕 No existing job found, proceeding with new processing`);
    }

    const existingStory = await Story.findOne({ jobId: jobData.jobId });
    if (existingStory) {
      console.log(`🔍 EXISTING STORY FOUND: Status = ${existingStory.status}`);
      if (existingStory.status === "completed") {
        console.log(`⏭️ Story ${jobData.jobId} already completed, skipping`);
        return { message: "Story already completed", jobId: jobData.jobId };
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
      jobData.location
    );

    console.log("Calling OpenAI service to generate scenes...");
    try {
      story = await openAIService.generateScenes(jobData.prompt);
      console.log("Generating Seedream Prompt...");
      seedreamPrompt = await openAIService.generateSeedreamPrompt(
        jobData.prompt,
        jobData.numOfScenes,
        jobData.style,
        jobData.title,
        jobData.genere,
        jobData.location
      );


//       story = {
//         title: "A Reunion in Cairo",
//         scenes: [
//           {
//             sceneNumber: 1,
//             imageDescription:
//               "A bustling street in Cairo during the late afternoon, with the sun casting long shadows. The protagonist, a man in his 30s, drives a vintage car. The architecture features traditional Egyptian buildings and vibrant street vendors.",
//             videoDescription:
//               "The camera tracks alongside the car as it moves slowly through the busy street. Suddenly, the protagonist spots his old friend waving from the sidewalk. The camera zooms in on their surprised expressions, capturing the joy of the unexpected reunion.",
//             sceneDescription:
//               "Driving through Cairo, he unexpectedly spots an old friend on the street.",
//             scenePrompt:
//               "A vintage car driving through a busy Cairo street with a man spotting his friend.",
//           },
//           {
//             sceneNumber: 2,
//             imageDescription:
//               "The same street, now with the two friends standing together, laughing and reminiscing. They are surrounded by the vibrant colors of the market stalls and the background features the iconic Cairo skyline.",
//             videoDescription:
//               "The camera circles around them, capturing their animated conversation. Their laughter fills the air as they gesture excitedly, the market bustling around them. The scene conveys warmth and nostalgia as they reconnect.",
//             sceneDescription:
//               "They meet on the street, sharing laughter and memories of the past.",
//             scenePrompt:
//               "Two friends joyfully reconnect on a bustling Cairo street, surrounded by market stalls.",
//           },
//         ],
//       };

//       seedreamPrompt = `number of images = 2
// Generate a story based on the following story
// story : A man is walking down a busy street in Cairo, driving his vintage Arabic car. Suddenly, he encounters an old friend he hasn't seen in a long time. The scene captures the surprise and joy of their reunion amidst the vibrant, bustling Cairo street life, with traditional architecture and street vendors in the background.

// 1- The main character is a middle-aged man with a friendly face, wearing casual modern clothes, consistent across both images.
// 2- The background shows a lively Cairo street with typical Egyptian elements: bustling crowds, street vendors, colorful shops, and historic buildings. The atmosphere is warm and lively, reflecting the energy of Cairo.
// 3- Style: realistic, detailed, and cinematic, visually engaging with a focus on the emotional reunion and street environment.

// Location: Egypt / style cinematic / title: "A Chance Meeting in Cairo"
//  CRITICAL CONSTRAINTS: Do Not mix two or more images in one image or generate images two or more in the same one`;


    } catch (openAIError) {
      console.error("OpenAI service error:", openAIError);
      throw new AppError("Failed to generate story scenes with OpenAI", 500);
    }
    console.log("Seedream Prompt Successfully Generated:", seedreamPrompt);
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
    let voiceOverUrl = "";
    let voiceOverText = "";
    if (jobData.voiceOver) {
      console.log("Processing voice over...");
      if (jobData.voiceOver.voiceOverLyrics != "null") {
        voiceOverText = jobData.voiceOver.voiceOverLyrics!;
      } else {
        voiceOverText = await openAIService.generateNarrativeText(
          jobData.prompt,
          jobData.voiceOver.voiceLanguage?.split(" ")[1] || "English",
          jobData.numOfScenes
        );
      }
      jobData.voiceOver.text = voiceOverText;
      const voiceOverService = new VoiceGenerationService();
      voiceOverUrl = await voiceOverService.generateVoiceOver(
        jobData.voiceOver
      );
      // voiceOverText =
      //   " كنت أسير في شوارع القاهرة بسيارتي، وفجأة لمحت صديقي الذي لم أره منذ زمن بعيد.";
      // voiceOverUrl =
      //   "https://d1q70pf5vjeyhc.cloudfront.net/predictions/464f29a448964e2cb6cfb3e7947647d1/1.mp3";
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
    try {
      if (!jobData.image) {
        console.log(
          "No reference image provided, generating from first scene prompt"
        );
        imageUrls = await imageGenerationService.generateSeedreamImages(
          seedreamPrompt,
          jobData.numOfScenes
        );
      } else {
        imageUrls = await imageGenerationService.generateSeedreamImages(
          seedreamPrompt,
          jobData.numOfScenes,
          [jobData.image!]
        );
      }
      // imageUrls = [
      //   "https://d1q70pf5vjeyhc.cloudfront.net/predictions/91756470b73b440e9066b23cc506de38/1.jpeg",
      //   "https://d1q70pf5vjeyhc.cloudfront.net/predictions/91756470b73b440e9066b23cc506de38/2.jpeg",
      // ];
    } catch (imageGenError) {
      console.error("Image generation error:", imageGenError);
      throw new AppError("Failed to generate images for the story scenes", 500);
    }
    console.log("Image URLS", imageUrls);
    if (!imageUrls) {
      throw new AppError(
        `Failed to generate images for the story scenes.`,
        500
      );
    }

    const invalidImages = imageUrls.filter(
      (url, _) => !url || typeof url !== "string" || !url.startsWith("http")
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
    const videoUrls = await videoGenerationService.generateVideos(imageUrls);
    console.log("JOB DATA VIDEOs: \n", videoUrls);
    // const videoUrls = [
    //   "https://d1q70pf5vjeyhc.cloudfront.net/predictions/a806989e1e1d48f5831a6aef95b2fdfd/1.mp4",
    //   "https://d1q70pf5vjeyhc.cloudfront.net/predictions/ea290eeac2a54734b78047b9a2a1ad9d/1.mp4",
    // ];
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

    let finalVideoBuffer = mergedVideoBuffer;

    // Compose video with sound directly using buffer
    if (jobData.voiceOver && voiceOverUrl) {
      updateJobProgress(
        job,
        95,
        `Composing video with sound`,
        getIO(),
        "story:progress"
      );

      console.log("🎵 Starting audio composition...");
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

        console.log("🎬 Calling composeSoundWithVideoBuffer...");
        const composedBuffer =
          await videoGenerationService.composeSoundWithVideoBuffer(
            finalVideoBuffer,
            voiceOverUrl,
            jobData.numOfScenes
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
          voiceOverLyrics: jobData.voiceOver["voiceOverLyrics"] || null,
          voiceLanguage: jobData.voiceOver["voiceLanguage"] || null,
          voiceGender: jobData.voiceOver["voiceGender"] || null,
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
});

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
        storyId: result.story?._id,
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
    storyId: String(result.story?._id || null),
    jobId: String(job.opts.jobId || null),
    status: String(result.story?.status || null),
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
        category: "activities",
      }
    );
    if (res) {
      user?.notifications?.push({
        title: "Model Processing Completed",
        message: `Your video generated successfully`,
        data: notificationDTO,
        redirectTo: "/storyDetails",
        createdAt: new Date(),
        category: "activities",
      });
      await user?.save();
      console.log("Push notification sent and saved to user notifications");
    }
  } catch (notificationError) {
    console.error("Failed to send push notification:", notificationError);
    if (user) {
      user.notifications?.push({
        title: "Model Processing Completed",
        message: `Your video generated successfully`,
        data: notificationDTO,
        redirectTo: "/storyDetails",
        createdAt: new Date(),
        category: "activities",
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

  // Handle the failure
  console.log(
    "Processing failure - sending notifications and updating database"
  );

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
            redirectTo: null,
            category: "activities",
          }
        );

        if (res) {
          user.notifications?.push({
            title: "Story Processing Failed",
            message: `Your video failed to generate.`,
            data: notificationDTO,
            redirectTo: null,
            createdAt: new Date(),
            category: "activities",
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
          redirectTo: null,
          createdAt: new Date(),
          category: "activities",
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
  console.warn(`⚠️ Job ${job.id} stalled`);
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
