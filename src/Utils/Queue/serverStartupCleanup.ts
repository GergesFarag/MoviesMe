import storyQueue from "../../Queues/story.queue";
import modelQueue from "../../Queues/model.queue";
import generationLibQueue from "../../Queues/generationLib.queue";
import { StoryQueueHandlers } from "../../Queues/Handlers/storyHandlers";
import { EffectsQueueHandler } from "../../Queues/Handlers/effectHandlers";
import { GenerationLibQueueHandler } from "../../Queues/Handlers/generationLibHandlers";
import logger from "../../Config/logger";

export class ServerStartupCleanup {
  private storyHandler: StoryQueueHandlers;
  private effectHandler: EffectsQueueHandler;
  private generationHandler: GenerationLibQueueHandler;

  constructor() {
    this.storyHandler = new StoryQueueHandlers();
    this.effectHandler = new EffectsQueueHandler();
    this.generationHandler = new GenerationLibQueueHandler();
  }

  async cleanupActiveJobs(): Promise<void> {
    console.log("🧹 Starting server startup cleanup - failing all active jobs...");

    try {
      const [storyActiveJobs, modelActiveJobs, generationActiveJobs] = await Promise.all([
        storyQueue.getActive(),
        modelQueue.getActive(), 
        generationLibQueue.getActive(),
      ]);

      console.log(`Found ${storyActiveJobs.length} story jobs, ${modelActiveJobs.length} model jobs, ${generationActiveJobs.length} generation jobs`);

      await Promise.all([
        ...storyActiveJobs.map(job => this.failStoryJob(job)),
        ...modelActiveJobs.map(job => this.failEffectJob(job)),
        ...generationActiveJobs.map(job => this.failGenerationJob(job)),
      ]);

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

      console.log(`Found ${storyWaiting.length} story waiting, ${modelWaiting.length} model waiting, ${generationWaiting.length} generation waiting`);

      // Process each queue type with its specific handler
      await Promise.all([
        ...storyWaiting.map(job => this.failStoryJob(job)),
        ...modelWaiting.map(job => this.failEffectJob(job)),
        ...generationWaiting.map(job => this.failGenerationJob(job)),
      ]);
    } catch (error) {
      console.error("❌ Error cleaning up waiting jobs:", error);
    }
  }

  private async failStoryJob(job: any): Promise<void> {
    try {
      console.log(`📝 Failing story job ${job.id}: Server restarted`);
      const error = new Error("Server restarted - job interrupted");
      await this.storyHandler.onFailed(job, error);
    } catch (error) {
      console.error(`❌ Error failing story job ${job.id}:`, error);
    }
  }

  private async failEffectJob(job: any): Promise<void> {
    try {
      console.log(`📝 Failing effect job ${job.id}: Server restarted`);
      const error = new Error("Server restarted - job interrupted");
      await this.effectHandler.onFailed(job, error);
    } catch (error) {
      console.error(`❌ Error failing effect job ${job.id}:`, error);
    }
  }

  private async failGenerationJob(job: any): Promise<void> {
    try {
      console.log(`� Failing generation job ${job.id}: Server restarted`);
      const error = new Error("Server restarted - job interrupted");
      await this.generationHandler.onFailed(job, error);
    } catch (error) {
      console.error(`❌ Error failing generation job ${job.id}:`, error);
    }
  }
}

export const serverStartupCleanup = new ServerStartupCleanup();