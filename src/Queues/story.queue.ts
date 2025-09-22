import Queue from "bull";
import { getRedisConfig } from "../Config/redis";
import { StoryProcessorService } from "../Services/storyProcessor.service";
import { StoryQueueHandlers } from "./Handlers/storyHandlers";
import { QUEUE_NAMES, JOB_OPTIONS, QUEUE_SETTINGS } from "./Constants/queueConstants";

const redisConfig = getRedisConfig();
console.log("Redis Config:", { ...redisConfig, password: redisConfig.password ? "******" : undefined });

export const storyQueue = new Queue(QUEUE_NAMES.STORY_PROCESSING, {
  redis: redisConfig,
  defaultJobOptions: JOB_OPTIONS,
  settings: QUEUE_SETTINGS,
});

const storyProcessor = new StoryProcessorService();
const queueHandlers = new StoryQueueHandlers();

storyQueue.process(async (job) => {
  console.log(`🚀 QUEUE ENTRY: Processing job ${job.id} with jobId: ${job.data.jobId}`);
  
  try {
    return await storyProcessor.processStory(job, job.data);
  } catch (error) {
    console.error("Error in story processing:", error);
    throw error;
  }
});

// Event handlers
storyQueue.on("completed", queueHandlers.onCompleted.bind(queueHandlers));
storyQueue.on("failed", queueHandlers.onFailed.bind(queueHandlers));
storyQueue.on("stalled", (job) => console.warn(`⚠️ Job ${job.id} stalled`));
storyQueue.on("error", (error) => console.error("❌ Queue error:", error));


// Queue monitoring
setInterval(async () => {
  await queueHandlers.getQueueStats(storyQueue);
}, 45000);

export default storyQueue;