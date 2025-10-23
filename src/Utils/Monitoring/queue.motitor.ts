import logger from '../../Config/logger';
import generationLibQueue from '../../Queues/generationLib.queue';
import taskQueue from '../../Queues/model.queue';
import storyQueue from '../../Queues/story.queue';
import { CreditService } from '../../Services/credits.service';
import { NotificationService } from '../../Services/notification.service';
import Job from '../../Models/job.model';
import Story from '../../Models/story.model';
import User from '../../Models/user.model';
import { Job as BullJob } from 'bull';

export class QueueMonitor {
  private effectQueue;
  private storyQueue;
  private generationQueue;
  private creditService;
  private notificationService;

  constructor() {
    this.effectQueue = taskQueue;
    this.storyQueue = storyQueue;
    this.generationQueue = generationLibQueue;
    this.creditService = CreditService.getInstance();
    this.notificationService = NotificationService.getInstance();
    this.failActiveJobs();
    this.logActiveJobs();
  }

  private async logActiveJobs() {
    const activeJobs = await this.getActiveJobsLength();
    logger.info({ 'Active Jobs:': activeJobs });
  }

  private async getActiveJobsLength() {
    const activeJobs = await this.getActiveJobs();
    return {
      stories: activeJobs.stories.length,
      effects: activeJobs.effects.length,
      generations: activeJobs.generations.length,
      total: activeJobs.total,
    };
  }

  private async getActiveJobs() {
    const [stories, effects, generations] = await Promise.all([
      this.storyQueue.getActive(),
      this.effectQueue.getActive(),
      this.generationQueue.getActive(),
    ]);

    return {
      stories: stories,
      effects: effects,
      generations: generations,
      total: stories.length + effects.length + generations.length,
    };
  }

  private async failActiveJobs() {
    await this.failActiveStoryJobs();
    await this.failActiveEffectJobs();
    await this.failActiveGenerationJobs();
  }

  private async failActiveStoryJobs() {
    const { stories } = await this.getActiveJobs();
    for (const job of stories) {
      try {
        // Update DB and refund credits - this handles everything
        await this.handleStoryJobFailure(job);

        // Safely remove job from queue
        await this.safeJobRemoval(job, 'story');
      } catch (error) {
        logger.error(`Failed to handle story job ${job.id} failure: ${error}`);
      }
    }
  }

  private async failActiveEffectJobs() {
    const { effects } = await this.getActiveJobs();
    for (const job of effects) {
      try {
        // Update DB and refund credits - this handles everything
        await this.handleEffectJobFailure(job);

        // Safely remove job from queue
        await this.safeJobRemoval(job, 'effect');
      } catch (error) {
        logger.error(`Failed to handle effect job ${job.id} failure: ${error}`);
      }
    }
  }

  private async failActiveGenerationJobs() {
    const { generations } = await this.getActiveJobs();
    for (const job of generations) {
      try {
        // Update DB and refund credits - this handles everything
        await this.handleGenerationJobFailure(job);

        // Safely remove job from queue
        await this.safeJobRemoval(job, 'generation');
      } catch (error) {
        logger.error(
          `Failed to handle generation job ${job.id} failure: ${error}`
        );
      }
    }
  }

  private async handleStoryJobFailure(job: BullJob): Promise<void> {
    try {
      const { userId, credits, jobId } = job.data;

      if (!userId || !jobId) {
        logger.warn(`Missing userId or jobId for story job ${job.id}`);
        return;
      }

      // Update job status in DB
      await Job.findOneAndUpdate(
        { jobId: jobId },
        {
          status: 'failed',
          updatedAt: new Date(),
          error: 'Server restarted',
        }
      );

      // Update story status in DB
      await Story.findOneAndUpdate(
        { jobId: jobId },
        {
          status: 'failed',
          title: 'Failed Story Generation',
          updatedAt: new Date(),
        }
      );

      // Refund credits
      if (credits) {
        const refund = await this.creditService.addCredits(
          userId,
          Number(credits)
        );

        if (refund) {
          const transactionNotificationData = {
            userCredits: await this.creditService.getCredits(userId),
            refundedCredits: Number(credits),
          };
          await this.notificationService.sendTransactionalSocketNotification(
            userId,
            transactionNotificationData
          );
          logger.info(
            `Refunded ${credits} credits to user ${userId} for story job ${job.id}`
          );
        } else {
          logger.error(`Failed to refund credits for story job ${job.id}`);
        }
      }
    } catch (error) {
      logger.error(
        `Error handling story job failure for job ${job.id}: ${error}`
      );
    }
  }

  private async handleEffectJobFailure(job: BullJob): Promise<void> {
    try {
      const { userId, modelData, jobId } = job.data;
      const jobIdToUse = jobId || job.opts?.jobId || job.id;

      if (!userId) {
        logger.warn(`Missing userId for effect job ${job.id}`);
        return;
      }

      // Update job status in DB
      await Job.findOneAndUpdate(
        { jobId: jobIdToUse },
        {
          status: 'failed',
          updatedAt: new Date(),
          error: 'Server restarted',
        }
      );

      // Update user's effectsLib
      const user = await User.findById(userId);
      if (user && user.effectsLib) {
        const item = user.effectsLib.find((item) => item.jobId === jobIdToUse);
        if (item) {
          item.status = 'failed';
          item.updatedAt = new Date();
          await user.save();
        }
      }

      // Refund credits
      const creditsToRefund = modelData?.credits;
      if (creditsToRefund) {
        const refund = await this.creditService.addCredits(
          userId,
          Number(creditsToRefund)
        );

        if (refund) {
          const transactionNotificationData = {
            userCredits: await this.creditService.getCredits(userId),
            refundedCredits: Number(creditsToRefund),
          };
          await this.notificationService.sendTransactionalSocketNotification(
            userId,
            transactionNotificationData
          );
          logger.info(
            `Refunded ${creditsToRefund} credits to user ${userId} for effect job ${job.id}`
          );
        } else {
          logger.error(`Failed to refund credits for effect job ${job.id}`);
        }
      }
    } catch (error) {
      logger.error(
        `Error handling effect job failure for job ${job.id}: ${error}`
      );
    }
  }

  private async handleGenerationJobFailure(job: BullJob): Promise<void> {
    try {
      const { userId, credits, jobId } = job.data;

      if (!userId || !jobId) {
        logger.warn(`Missing userId or jobId for generation job ${job.id}`);
        return;
      }

      // Update job status in DB
      await Job.findOneAndUpdate(
        { jobId: jobId },
        {
          status: 'failed',
          updatedAt: new Date(),
          error: 'Server restarted',
        }
      );

      // Update user's generationLib
      const user = await User.findById(userId);
      if (user && user.generationLib) {
        const itemIndex = user.generationLib.findIndex(
          (item) => item.jobId === jobId
        );
        if (itemIndex >= 0) {
          user.generationLib[itemIndex].status = 'failed';
          user.generationLib[itemIndex].updatedAt = new Date();
          await user.save();
        }
      }

      // Refund credits
      if (credits) {
        const refund = await this.creditService.addCredits(
          String(userId),
          Number(credits)
        );

        if (refund) {
          const transactionNotificationData = {
            userCredits: await this.creditService.getCredits(userId),
            refundedCredits: Number(credits),
          };
          await this.notificationService.sendTransactionalSocketNotification(
            userId,
            transactionNotificationData
          );
          logger.info(
            `Refunded ${credits} credits to user ${userId} for generation job ${job.id}`
          );
        } else {
          logger.error(`Failed to refund credits for generation job ${job.id}`);
        }
      }
    } catch (error) {
      logger.error(
        `Error handling generation job failure for job ${job.id}: ${error}`
      );
    }
  }

  private async safeJobRemoval(job: BullJob, jobType: string): Promise<void> {
    try {
      const isActive = await job.isActive();

      if (isActive) {
        try {
          // Add a flag to job data to indicate this was already handled
          const updatedData = {
            ...job.data,
            _serverRestartCleanup: true,
            _cleanupTimestamp: Date.now(),
          };

          await job.update(updatedData);
          logger.info(`✅ Marked ${jobType} job ${job.id} with cleanup flag.`);

          await job.moveToFailed(
            { message: 'Server restarted - job interrupted' },
            true // ignoreLock - allows failing active jobs
          );
          logger.info(
            `✅ Moved active ${jobType} job ${job.id} to failed state.`
          );
          try {
            await job.remove();
            logger.info(
              `✅ Removed ${jobType} job ${job.id} from queue to allow retry.`
            );
          } catch (removeErr) {
            logger.info(
              `ℹ️ ${jobType} job ${job.id} in failed state. Retry should still work by overwriting.`
            );
          }
        } catch (error: any) {
          logger.warn(
            `⚠️ Could not cleanup active ${jobType} job ${job.id}: ${error?.message}. Job may block retry temporarily.`
          );
        }
      } else {
        const jobExists =
          (await job.isWaiting()) ||
          (await job.isDelayed()) ||
          (await job.isCompleted()) ||
          (await job.isFailed());

        if (jobExists) {
          try {
            await job.remove();
            logger.info(
              `✅ Removed non-active ${jobType} job ${job.id} from queue.`
            );
          } catch (removeErr: any) {
            logger.info(
              `ℹ️ Could not remove ${jobType} job ${job.id}. Will be cleaned up automatically.`
            );
          }
        } else {
          logger.info(`ℹ️ ${jobType} job ${job.id} no longer in queue.`);
        }
      }
    } catch (error: any) {
      logger.warn(
        `⚠️ ${jobType} job ${job.id} queue cleanup error: ${error?.message}. DB and credits already handled.`
      );
    }
  }
}
