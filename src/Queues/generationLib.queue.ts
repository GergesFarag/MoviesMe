import Queue from "bull";
import { getRedisConfig } from "../Config/redis";
import {
  JOB_OPTIONS,
  QUEUE_NAMES,
  QUEUE_SETTINGS,
} from "./Constants/queueConstants";
import { GenerationLibQueueHandler } from "./Handlers/generationLibHandlers";
import { ImageGenerationService } from "../Services/imageGeneration.service";
import { VideoGenerationService } from "../Services/videoGeneration.service";

export interface IGenerationLibQueueHandler {
  processGenerationLib(job: any): Promise<any>;
  onCompleted(job: any, result: any): void;
  onFailed(job: any, error: any): void;
}

export class GenerationLibQueue {
  public readonly queue: Queue.Queue;
  constructor(
    deps: {
      redisConfig?: ReturnType<typeof getRedisConfig>;
      handlers: IGenerationLibQueueHandler;
    }
  ) {
    const { redisConfig = getRedisConfig(), handlers } = deps;

    this.queue = new Queue(QUEUE_NAMES.GENERATION_LIB, {
      redis: redisConfig,
      defaultJobOptions: JOB_OPTIONS,
      settings: QUEUE_SETTINGS,
    });

    this.queue.process(async (job) => {
      const data = await handlers.processGenerationLib(job);
      return data;
    });

    this.queue.on("completed", (job, result) => {
      handlers.onCompleted(job, result);
    });

    this.queue.on("failed", (job, error) => {
      handlers.onFailed(job, error);
    });
  }
}

const generationLibQueueInstance = new GenerationLibQueue({
  redisConfig: getRedisConfig(),
  handlers: new GenerationLibQueueHandler(
    new ImageGenerationService(),
    new VideoGenerationService()
  ),
});

export const generationLibQueue = generationLibQueueInstance.queue;
export default generationLibQueue;