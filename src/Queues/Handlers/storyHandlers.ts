import { Job } from "bull";
import { getIO } from "../../Sockets/socket";
import { NotificationService } from "../../Services/notification.service";
import JobModel from "../../Models/job.model";
import Story from "../../Models/story.model";

export class StoryQueueHandlers {
  private notificationService = new NotificationService();

  /**
   * Handle job completion
   */
  async onCompleted(job: Job, result: any) {
    console.log(`✅ Story job with ID ${job.id} has been completed.`);
    console.log("Result:", result);

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
        console.warn("⚠️ Missing userId or story data, skipping completion notifications");
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

  /**
   * Handle job failure
   */
  async onFailed(job: Job, err: Error) {
    console.log(`❌ Story job with ID ${job?.id} has failed.`);
    console.log("Error:", err);

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
  
  /**
   * Update job and story status to failed in database
   */
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

  /**
   * Get queue statistics for monitoring
   */
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

  /**
   * Clean up old completed/failed jobs
   */
  async cleanupOldJobs(
    queue: any,
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<void> {
    try {
      const now = Date.now();

      const [completed, failed] = await Promise.all([
        queue.getCompleted(),
        queue.getFailed(),
      ]);

      // Remove old completed jobs
      const oldCompleted = completed.filter(
        (job: any) => now - job.timestamp > maxAge
      );

      // Remove old failed jobs
      const oldFailed = failed.filter(
        (job: any) => now - job.timestamp > maxAge
      );

      await Promise.all([
        ...oldCompleted.map((job: any) => job.remove()),
        ...oldFailed.map((job: any) => job.remove()),
      ]);

      if (oldCompleted.length > 0 || oldFailed.length > 0) {
        console.log(
          `🧹 Cleaned up ${oldCompleted.length} old completed jobs and ${oldFailed.length} old failed jobs`
        );
      }
    } catch (error) {
      console.error("❌ Failed to cleanup old jobs:", error);
    }
  }
}
