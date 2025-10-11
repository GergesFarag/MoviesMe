import storyQueue from "../../Queues/story.queue";
import modelQueue from "../../Queues/model.queue";
import generationLibQueue from "../../Queues/generationLib.queue";
import JobModel from "../../Models/job.model";
import Story from "../../Models/story.model";
import { CreditService } from "../../Services/credits.service";

export class ServerStartupCleanup {
  private creditService: CreditService;

  constructor() {
    this.creditService = new CreditService();
  }

  async cleanupActiveJobs(): Promise<void> {
    console.log("🧹 Starting server startup cleanup - failing all active jobs...");

    try {

      const [storyActiveJobs, modelActiveJobs, generationActiveJobs] = await Promise.all([
        storyQueue.getActive(),
        modelQueue.getActive(), 
        generationLibQueue.getActive(),
      ]);

      const allActiveJobs = [
        ...storyActiveJobs,
        ...modelActiveJobs,
        ...generationActiveJobs,
      ];

      console.log(`Found ${allActiveJobs.length} active jobs to clean up`);


      for (const job of allActiveJobs) {
        await this.failJob(job, "Server restarted - job interrupted");
      }

      await this.cleanupWaitingJobs();

      console.log("✅ Server startup cleanup completed");
    } catch (error) {
      console.error("❌ Error during server startup cleanup:", error);
    }
  }


  private async cleanupWaitingJobs(): Promise<void> {
    try {
      const [storyWaiting, modelWaiting, generationWaiting] = await Promise.all([
        storyQueue.getWaiting(),
        modelQueue.getWaiting(),
        generationLibQueue.getWaiting(),
      ]);

      const allWaitingJobs = [
        ...storyWaiting,
        ...modelWaiting,
        ...generationWaiting,
      ];
      for (const job of allWaitingJobs) {
        await this.failJob(job, "Server restarted - job cancelled");
      }
    } catch (error) {
      console.error("❌ Error cleaning up waiting jobs:", error);
    }
  }

  private async failJob(job: any, reason: string): Promise<void> {
    try {
      const jobData = job.data;
      
      console.log(`📝 Failing job ${job.id}: ${reason}`);

      // Update job status in database
      if (job.opts?.jobId || jobData?.jobId) {
        const jobId = job.opts?.jobId || jobData?.jobId;
        
        await JobModel.findOneAndUpdate(
          { jobId: jobId },
          {
            status: "failed",
            updatedAt: new Date(),
            error: reason,
          }
        );

        // Update story status if it's a story job
        await Story.findOneAndUpdate(
          { jobId: jobId },
          {
            status: "failed",
            title: "Failed Story Generation (Server Restarted)",
            updatedAt: new Date(),
          }
        );
      }

      // Refund credits if applicable
      if (jobData?.userId && jobData?.credits) {
        const refund = await this.creditService.addCredits(
          jobData.userId,
          jobData.credits
        );
        
        if (refund) {
          console.log(`💰 Refunded ${jobData.credits} credits to user ${jobData.userId}`);
        }
      }

      // Remove the job from the queue
      await job.remove();
      console.log(`🗑️ Removed job ${job.id} from queue`);

    } catch (error) {
      console.error(`❌ Error failing job ${job.id}:`, error);
    }
  }
}

export const serverStartupCleanup = new ServerStartupCleanup();