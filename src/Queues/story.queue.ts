import Queue from "bull";
import { getRedisConfig } from "../Config/redis";
import { StoryProcessorService } from "../Services/Processors/storyProcessor.service";
import { ImageGenerationService } from "../Services/imageGeneration.service";
import { VideoGenerationService } from "../Services/videoGeneration.service";
import { VoiceGenerationService } from "../Services/voiceGeneration.service";
import { SFXService } from "../Services/sfx.service";
import { StoryQueueHandlers } from "./Handlers/storyHandlers";
import { QUEUE_NAMES, JOB_OPTIONS, QUEUE_SETTINGS } from "./Constants/queueConstants";

export interface IStoryProcessorService {
  processStory(job: any, data: any): Promise<any>;
}

export interface IStoryQueueHandlers {
  onCompleted(job: any, result: any): void;
  onFailed(job: any, error: any): void;
}

export class StoryQueue {
  public readonly queue: Queue.Queue;
  constructor(
    deps: {
      redisConfig?: ReturnType<typeof getRedisConfig>;
      processor: IStoryProcessorService;
      handlers: IStoryQueueHandlers;
    }
  ) {
    const { redisConfig = getRedisConfig(), processor, handlers } = deps;

    this.queue = new Queue(QUEUE_NAMES.STORY_PROCESSING, {
      redis: redisConfig,
      defaultJobOptions: JOB_OPTIONS,
      settings: QUEUE_SETTINGS,
    });

    this.queue.process(async (job) => {
      console.log(`🚀 QUEUE ENTRY: Processing job ${job.id} with jobId: ${job.data.jobId}`);
      console.log(`📊 Job data:`, JSON.stringify(job.data, null, 2));

      try {
        return await processor.processStory(job, job.data);
      } catch (error) {
        throw error;
      }
    });

    this.queue.on("completed", (job, result) => {
      handlers.onCompleted(job, result);
    });
    this.queue.on("failed", (job, error) => {
      handlers.onFailed(job, error);
    });
    this.queue.on("error", (error) => console.error("❌ Queue error:", error));
  }
}

const storyQueueInstance = new StoryQueue({
  redisConfig: getRedisConfig(),
  processor: new StoryProcessorService(
    new ImageGenerationService(),
    new VideoGenerationService(),
    new VoiceGenerationService(),
    new SFXService()
  ),
  handlers: new StoryQueueHandlers(),
});

export const storyQueue = storyQueueInstance.queue;
export default storyQueue;
