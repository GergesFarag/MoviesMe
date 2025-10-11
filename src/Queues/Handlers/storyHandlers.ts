import { Job } from "bull";
import { getIO } from "../../Sockets/socket";
import {
  NotificationData,
  NotificationService,
} from "../../Services/notification.service";
import JobModel from "../../Models/job.model";
import Story from "../../Models/story.model";
import storyQueue from "../story.queue";
import AppError from "../../Utils/Errors/AppError";
import { CreditService } from "../../Services/credits.service";

export class StoryQueueHandlers {
  private notificationService;
  private creditService;
  constructor() {
    this.notificationService = new NotificationService();
    this.creditService = new CreditService();
  }
  async onCompleted(job: Job, result: any) {
    console.log(`✅ Story job with ID ${job.id} has been completed.`);
    console.log("Result:", result);
    await storyQueue.removeJobs(job.data.jobId);
    try {
      if (job.data.userId && result?.story) {
        await this.notificationService.sendStoryCompletionNotification(
          job.data.userId,
          result.story,
          result.finalVideoUrl || "",
          String(job.opts.jobId || "")
        );
        console.log(`📤 All completion notifications sent for job ${job.id}`);
      } else {
        console.warn(
          "⚠️ Missing userId or story data, skipping completion notifications"
        );
      }
    } catch (error) {
      console.error("❌ Error in completion handler:", error);
    } finally {
      try {
        await job.remove();
        console.log(`🗑️ Job ${job.id} removed from queue`);
      } catch (removeError) {
        console.error("❌ Failed to remove completed job:", removeError);
      }
    }
  }

  async onFailed(job: Job, err: Error | AppError) {
    console.log(`❌ Story job with ID ${job?.id} has failed.`);
    console.log("Error:", err);
    await storyQueue.removeJobs(job.data.jobId);
    const refund = await this.creditService.addCredits(
      job.data.userId,
      job.data.credits
    );
    if (!refund) {
      console.error(`❌ Failed to refund credits for user ${job.data.userId}`);
    }
    const transactionNotificationData = {
      userCredits: await this.creditService.getCredits(job.data.userId),
      refundedCredits: job.data.credits,
    };
    await this.notificationService.sendTransactionalSocketNotification(
      job.data.userId,
      transactionNotificationData
    );
    try {
      await this.updateFailedJobStatus(job);

      if (job?.data?.userId) {
        await this.notificationService.sendStoryFailureNotification(
          job.data.userId,
          String(job.opts?.jobId || ""),
          err,
          job.data.storyId
        );
        console.log(`📤 All failure notifications sent for job ${job?.id}`);
      } else {
        console.warn("⚠️ Missing userId, skipping failure notifications");
      }
    } catch (error) {
      console.error("❌ Error in failure handler:", error);
    }
  }

  private async updateFailedJobStatus(job: Job): Promise<void> {
    if (!job?.opts?.jobId) {
      console.log("⚠️ No jobId found, skipping database status update");
      return;
    }

    try {
      // Update job status
      await JobModel.findOneAndUpdate(
        { jobId: job.opts.jobId as string },
        {
          status: "failed",
          updatedAt: new Date(),
          error: "Processing failed",
        }
      );

      // Update story status
      await Story.findOneAndUpdate(
        { jobId: job.opts.jobId as string },
        {
          status: "failed",
          title: "Failed Story Generation",
          updatedAt: new Date(),
        }
      );

      console.log(
        `✅ Updated job and story status to failed for jobId: ${job.opts.jobId}`
      );
    } catch (dbError) {
      console.error(
        "❌ Failed to update job/story status in database:",
        dbError
      );
    }
  }

  async getQueueStats(queue: any): Promise<void> {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
      ]);

      console.log(
        `📈 Queue Stats - Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}`
      );
    } catch (error) {
      console.error("❌ Failed to get queue statistics:", error);
    }
  }
}
