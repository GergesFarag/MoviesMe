import { clearVoiceCache } from "../Cache/voiceCache";
import { VoiceGenerationService } from "../../Services/voiceGeneration.service";

// Utility functions to help recover from ElevenLabs abuse detection

export const clearAllVoiceCaches = (): void => {
  try {
    clearVoiceCache();
    console.log("All voice caches cleared successfully");
  } catch (error) {
    console.error("Error clearing voice caches:", error);
  }
};

export const checkElevenLabsStatus = async (): Promise<boolean> => {
  try {
    const voiceService = new VoiceGenerationService();
    // Try a minimal test request to check if ElevenLabs is accessible
    const testData = {
      voiceGender: "male",
      voiceOverLyrics: "Test"
    };
    
    // This would be a mock test - in reality you might want to make a simple API call
    console.log("ElevenLabs status check initiated");
    return true; // Placeholder - implement actual status check if needed
  } catch (error) {
    console.error("ElevenLabs status check failed:", error);
    return false;
  }
};

export const getRecoveryInstructions = (): string[] => {
  return [
    "1. Clear voice cache using the clearCache method",
    "2. Ensure your deployment is not using VPN/Proxy",
    "3. Check if OPENAI_API_KEY is set for fallback TTS",
    "4. Set USE_OPENAI_TTS_FALLBACK=true to prioritize OpenAI TTS",
    "5. Contact ElevenLabs support if the issue persists",
    "6. Consider upgrading to ElevenLabs paid plan to avoid free tier limitations"
  ];
};

export const logEnvironmentForDebugging = (): void => {
  console.log("=== Voice Generation Environment Debug Info ===");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("RENDER:", process.env.RENDER);
  console.log("RENDER_SERVICE_NAME:", process.env.RENDER_SERVICE_NAME);
  console.log("USE_OPENAI_TTS_FALLBACK:", process.env.USE_OPENAI_TTS_FALLBACK);
  console.log("ELEVENLABS_API_KEY present:", !!process.env.ELEVENLABS_API_KEY);
  console.log("OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);
  console.log("================================================");
};