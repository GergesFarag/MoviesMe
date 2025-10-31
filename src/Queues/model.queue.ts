import Queue from 'bull';
import { getRedisConfig } from '../Config/redis';
import {
  JOB_OPTIONS,
  QUEUE_NAMES,
  QUEUE_SETTINGS,
} from './Constants/queueConstants';
import { EffectsQueueHandler } from './Handlers/effectHandlers';
import { EffectProcessorService } from '../Services/Processors/effectProcessor.service';

export interface IEffectProcessorService {
  processEffect(job: any): Promise<any>;
}

export interface IEffectsQueueHandler {
  onCompleted(job: any, result: any): void;
  onFailed(job: any, error: any): void;
}

export class ModelQueue {
  public readonly queue: Queue.Queue;
  constructor(
    deps: {
      redisConfig?: ReturnType<typeof getRedisConfig>;
      processor: IEffectProcessorService;
      handlers: IEffectsQueueHandler;
    }
  ) {
    const { redisConfig = getRedisConfig(), processor, handlers } = deps;

    this.queue = new Queue(QUEUE_NAMES.MODEL_PROCESSING, {
      redis: redisConfig,
      defaultJobOptions: JOB_OPTIONS,
      settings: QUEUE_SETTINGS,
    });

    this.queue.process(async (job) => {
      const data = await processor.processEffect(job);
      return data;
    });

    this.queue.on('completed', handlers.onCompleted.bind(handlers));
    this.queue.on('failed', handlers.onFailed.bind(handlers));
  }
}

// Backward-compatible default instance
const modelQueueInstance = new ModelQueue({
  redisConfig: getRedisConfig(),
  processor: EffectProcessorService.getInstance(),
  handlers: new EffectsQueueHandler(),
});

export const taskQueue = modelQueueInstance.queue;
export default taskQueue;
