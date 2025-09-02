import { taskQueue } from "../../Queues/model.queue";

/**
 * Clean up old completed and failed jobs from Redis
 * Call this periodically to prevent memory buildup
 */
export const cleanupRedisJobs = async (): Promise<void> => {
  try {
    await taskQueue.clean(60 * 60 * 1000, "completed");
    
    await taskQueue.clean(60 * 60 * 1000, "failed");
    
    await taskQueue.clean(2 * 60 * 60 * 1000, "active");
    
    console.log("Redis job cleanup completed successfully");
  } catch (error) {
    console.error("Error cleaning up Redis jobs:", error);
  }
};

export const getRedisMemoryInfo = async (): Promise<any> => {
  try {
    const client = taskQueue.client;
    const info = await client.info("memory");
    return info;
  } catch (error) {
    console.error("Error getting Redis memory info:", error);
    return null;
  }
};
