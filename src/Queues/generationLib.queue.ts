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

let generationLibQueueHandlers: GenerationLibQueueHandler | null = null;

function getGenerationLibQueueHandlers(): GenerationLibQueueHandler {
  if (!generationLibQueueHandlers) {
    generationLibQueueHandlers = new GenerationLibQueueHandler();
  }
  return generationLibQueueHandlers;
}

generationLibQueue.process(async (job) => {
  const handlers = getGenerationLibQueueHandlers();
  const data = await handlers.processGenerationLib(job);
  return data;
});

generationLibQueue.on(
  "completed",
  (job, result) => {
    const handlers = getGenerationLibQueueHandlers();
    handlers.onCompleted(job, result);
  }
);

generationLibQueue.on(
  "failed",
  (job, error) => {
    const handlers = getGenerationLibQueueHandlers();
    handlers.onFailed(job, error);
  }
);

export default generationLibQueue;