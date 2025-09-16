import NodeCache from 'node-cache';
import crypto from 'crypto';

// Cache for voice generations (TTL: 1 hour)
const voiceCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export const getCachedVoice = (text: string, voiceId: string): string | null => {
  const cacheKey = generateVoiceCacheKey(text, voiceId);
  return voiceCache.get<string>(cacheKey) || null;
};

export const setCachedVoice = (text: string, voiceId: string, audioUrl: string): void => {
  const cacheKey = generateVoiceCacheKey(text, voiceId);
  voiceCache.set(cacheKey, audioUrl);
  console.log(`Voice cached for key: ${cacheKey}`);
};

const generateVoiceCacheKey = (text: string, voiceId: string): string => {
  // Create a hash of the text and voice ID for consistent caching
  const hash = crypto.createHash('md5').update(`${text}_${voiceId}`).digest('hex');
  return `voice_${hash}`;
};

export const getVoiceCacheStats = () => {
  return {
    keys: voiceCache.keys().length,
    stats: voiceCache.getStats()
  };
};