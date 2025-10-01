import Queue from "bull";
import { getRedisConfig } from "../Config/redis";
import {
  JOB_OPTIONS,
  QUEUE_NAMES,
  QUEUE_SETTINGS,
} from "./Constants/queueConstants";
import { GenerationLibQueueHandler } from "./Handlers/generationLibHandlers";

const redisConfig = getRedisConfig();

export const generationLibQueue = new Queue(QUEUE_NAMES.GENERATION_LIB, {
  redis: redisConfig,
  defaultJobOptions: JOB_OPTIONS,
  settings: QUEUE_SETTINGS,
});

const generationLibQueueHandlers = new GenerationLibQueueHandler();

generationLibQueue.process(async (job) => {
  const data = await generationLibQueueHandlers.processGenerationLib(job);
  return data;
});

generationLibQueue.on(
  "completed",
  generationLibQueueHandlers.onCompleted.bind(generationLibQueueHandlers)
);

generationLibQueue.on(
  "failed",
  generationLibQueueHandlers.onFailed.bind(generationLibQueueHandlers)
);

export default generationLibQueue;