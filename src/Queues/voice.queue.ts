// Alternative voice generation queue for free tier usage
import Queue from 'bull';
import { VoiceGenerationService } from '../Services/voiceGeneration.service';

const voiceQueue = new Queue('voice generation', process.env.REDIS_URL || 'redis://localhost:6379');

// Configure queue to process one job at a time with delays
voiceQueue.process(1, async (job) => {
  const { data, narration } = job.data;
  const voiceService = new VoiceGenerationService();
  
  // Add extra delay for free tier
  await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay
  
  return await voiceService.generateVoiceOver(data, narration);
});

export const queueVoiceGeneration = async (data: any, narration?: string) => {
  const job = await voiceQueue.add('generate-voice', { data, narration }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30 second backoff
    },
  });
  
  return job;
};

export default voiceQueue;