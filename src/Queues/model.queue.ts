import Queue from 'bull';
import { getRedisConfig } from '../Config/redis';
import {
  JOB_OPTIONS,
  QUEUE_NAMES,
  QUEUE_SETTINGS,
} from './Constants/queueConstants';
import { EffectsQueueHandler } from './Handlers/effectHandlers';
import { EffectProcessorService } from '../Services/Processors/effectProcessor.service';

const redisConfig = getRedisConfig();
export const taskQueue = new Queue(QUEUE_NAMES.MODEL_PROCESSING, {
  redis: redisConfig,
  defaultJobOptions: JOB_OPTIONS,
  settings: QUEUE_SETTINGS,
});

const effectQueueHandlers = new EffectsQueueHandler();
const effectProcessorService = EffectProcessorService.getInstance();

taskQueue.process(async (job) => {
  // Reuse the same instance for all jobs
  const data = await effectProcessorService.processEffect(job);
  return data;
});

taskQueue.on(
  'completed',
  effectQueueHandlers.onCompleted.bind(effectQueueHandlers)
);

taskQueue.on('failed', effectQueueHandlers.onFailed.bind(effectQueueHandlers));

export default taskQueue;
