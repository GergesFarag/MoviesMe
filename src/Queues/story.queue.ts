import Queue from "bull";
import { getRedisConfig } from "../Config/redis";
import { StoryProcessorService } from "../Services/Processors/storyProcessor.service";
import { StoryQueueHandlers } from "./Handlers/storyHandlers";
import { QUEUE_NAMES, JOB_OPTIONS, QUEUE_SETTINGS } from "./Constants/queueConstants";

const redisConfig = getRedisConfig();
console.log("Redis Config:", { ...redisConfig, password: redisConfig.password ? "******" : undefined });

export const storyQueue = new Queue(QUEUE_NAMES.STORY_PROCESSING, {
  redis: redisConfig,
  defaultJobOptions: JOB_OPTIONS,
  settings: QUEUE_SETTINGS,
});

let storyProcessor: StoryProcessorService | null = null;
let queueHandlers: StoryQueueHandlers | null = null;

function getStoryProcessor(): StoryProcessorService {
  if (!storyProcessor) {
    storyProcessor = new StoryProcessorService();
  }
  return storyProcessor;
}

function getQueueHandlers(): StoryQueueHandlers {
  if (!queueHandlers) {
    queueHandlers = new StoryQueueHandlers();
  }
  return queueHandlers;
}

storyQueue.process(async (job) => {
  console.log(`🚀 QUEUE ENTRY: Processing job ${job.id} with jobId: ${job.data.jobId}`);
  console.log(`📊 Job data:`, JSON.stringify(job.data, null, 2));

  try {
    const processor = getStoryProcessor();
    return await processor.processStory(job, job.data);
  } catch (error) {
    console.error("Error in story processing:", error);
    throw error;
  }
});

// Event handlers
storyQueue.on("completed", (job, result) => {
  const handlers = getQueueHandlers();
  handlers.onCompleted(job, result);
});
storyQueue.on("failed", (job, error) => {
  const handlers = getQueueHandlers();
  handlers.onFailed(job, error);
});
storyQueue.on("error", (error) => console.error("❌ Queue error:", error));


export default storyQueue;
