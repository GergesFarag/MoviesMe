import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getVoiceId } from "../Utils/Database/optimizedOps";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import { cloudUploadAudio } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { streamToBuffer } from "../Utils/Format/streamToBuffer";
import { getCachedVoice, setCachedVoice, clearVoiceCache } from "../Utils/Cache/voiceCache";
import { OpenAIService } from "./openAi.service";
import { isHighRiskEnvironment, getEnvironmentInfo } from "../Utils/Environment/environmentDetection";

const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY as string) || "";
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_RENDER = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;
const USE_OPENAI_FALLBACK = process.env.USE_OPENAI_TTS_FALLBACK === 'true' || IS_RENDER;

// Rate limiting for ElevenLabs API calls
class ElevenLabsRateLimiter {
  private lastCallTime: number = 0;
  private readonly minInterval: number;

  constructor() {
    // More conservative rate limiting for cloud environments (default: 5 seconds)
    // Render and other cloud services need longer delays to avoid abuse detection
    const baseInterval = IS_PRODUCTION ? "8000" : "3000";
    // Extra delay for Render specifically
    const renderInterval = IS_RENDER ? "12000" : baseInterval;
    this.minInterval = parseInt(process.env.ELEVENLABS_RATE_LIMIT_MS || renderInterval, 10);
    console.log(`ElevenLabs rate limiter initialized with ${this.minInterval}ms interval (Production: ${IS_PRODUCTION}, Render: ${IS_RENDER})`);
  }

  async waitForNextCall(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      console.log(`Rate limiting: waiting ${waitTime}ms before next ElevenLabs API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }
}

const rateLimiter = new ElevenLabsRateLimiter();

export class VoiceGenerationService {
  private client: ElevenLabsClient;
  private openAIService: OpenAIService;

  constructor() {
    try {
      this.client = new ElevenLabsClient({ 
        apiKey: ELEVENLABS_API_KEY,
      });
      // Initialize OpenAI service for fallback TTS
      this.openAIService = new OpenAIService(1); // Minimal setup for TTS only
    } catch (error) {
      console.log("err", error);
      throw new AppError(
        "ElevenLabs Client initialization failed",
        HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }
  }

  async generateVoiceOver(
    data: IStoryRequest["voiceOver"],
    narration?: string,
    req?: any
  ): Promise<string> {
    let voiceId: string | null = null;
    if (data?.voiceGender) {
      voiceId = await getVoiceId(data!.voiceGender);
      if (!voiceId)
        throw new AppError("No voiceId found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    if (!data?.voiceOverLyrics && !narration) {
      throw new AppError(
        "No voiceOverLyrics or narration provided",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }
    if (!data?.voiceOverLyrics) data!.voiceOverLyrics = narration as string;
    
    const finalVoiceId = voiceId || "CwhRBWXzGAHq8TQ4Fs17";
    
    // Log environment information
    const envInfo = getEnvironmentInfo(req);
    const isHighRisk = isHighRiskEnvironment(req);
    console.log(`Environment Analysis:`, {
      ...envInfo,
      isHighRisk,
      shouldUseOpenAIFirst: USE_OPENAI_FALLBACK && (IS_RENDER || isHighRisk)
    });
    
    // Check cache first
    const cachedAudio = getCachedVoice(data!.voiceOverLyrics, finalVoiceId);
    if (cachedAudio) {
      console.log("Using cached voice generation");
      return cachedAudio;
    }
    
    // If running in high-risk environment or fallback is enabled, try OpenAI first
    if (USE_OPENAI_FALLBACK && (IS_RENDER || isHighRisk)) {
      console.log("Using OpenAI TTS as primary due to high-risk environment detection");
      try {
        const openAIVoice = this.mapVoiceGenderToOpenAI(data?.voiceGender);
        const openAIResult = await this.openAIService.generateTTS(data!.voiceOverLyrics, openAIVoice);
        
        // Cache the result
        setCachedVoice(data!.voiceOverLyrics, `openai_${openAIVoice}`, openAIResult);
        
        return openAIResult;
      } catch (openAIError: any) {
        console.log("OpenAI TTS failed, falling back to ElevenLabs:", openAIError.message);
        // Continue to ElevenLabs as fallback
      }
    }
    
    // Apply rate limiting for new API calls
    await rateLimiter.waitForNextCall();
    
    console.log(`Generating voice with ElevenLabs - Voice: ${data?.voiceGender}, Text length: ${data?.voiceOverLyrics?.length}, Environment: ${IS_PRODUCTION ? 'Production' : 'Development'}, Render: ${IS_RENDER}`);
    
    // Retry logic for production environments
    const maxRetries = IS_PRODUCTION ? 3 : 1;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`Retry attempt ${attempt}/${maxRetries} for ElevenLabs API call`);
          // Exponential backoff for retries
          await new Promise(resolve => setTimeout(resolve, attempt * 10000));
        }
        
        const audio = await this.client.textToSpeech.convert(
          finalVoiceId,
          {
            text: data!.voiceOverLyrics,
            outputFormat: "mp3_44100_128",
          }
        );

        const audioBuffer = await streamToBuffer(audio);
        const uploadResult = await cloudUploadAudio(audioBuffer);
        
        // Cache the result
        setCachedVoice(data!.voiceOverLyrics, finalVoiceId, uploadResult.secure_url);
        
        console.log(`ElevenLabs voice generation completed successfully on attempt ${attempt}`);
        return uploadResult.secure_url;
        
      } catch (error: any) {
        lastError = error;
        console.error(`ElevenLabs API Error (attempt ${attempt}/${maxRetries}):`, error);
        
        // Check for specific ElevenLabs errors that indicate abuse detection or rate limiting
        if (error.statusCode === 401 || 
            error.message?.includes("unusual activity") || 
            error.message?.includes("Free Tier") ||
            error.message?.includes("detected_unusual_activity") ||
            error.body?.detail?.status === "detected_unusual_activity") {
          
          console.log("ElevenLabs abuse detection triggered, attempting OpenAI TTS fallback...");
          
          try {
            // Map voice gender to OpenAI voice
            const openAIVoice = this.mapVoiceGenderToOpenAI(data?.voiceGender);
            const fallbackResult = await this.openAIService.generateTTS(data!.voiceOverLyrics, openAIVoice);
            
            // Cache the result with a different key to indicate it's from OpenAI
            setCachedVoice(data!.voiceOverLyrics, `openai_${openAIVoice}`, fallbackResult);
            
            console.log("Successfully generated voice using OpenAI TTS fallback");
            return fallbackResult;
            
          } catch (fallbackError: any) {
            console.error("OpenAI TTS fallback also failed:", fallbackError);
            // Continue with the original retry logic for ElevenLabs if fallback fails
          }
          
          if (attempt === maxRetries) {
            throw new AppError(
              "Voice generation failed: ElevenLabs detected unusual activity and OpenAI fallback unavailable. Please check your deployment environment for proxy/VPN usage.",
              HTTP_STATUS_CODE.TOO_MANY_REQUESTS
            );
          }
          // Continue to retry for abuse detection errors
          continue;
        }
        
        // For other errors, don't retry
        break;
      }
    }
    
    // If we get here, all retries failed
    throw new AppError(
      `Voice generation failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }

  // Helper method to map voice gender to OpenAI voice options
  private mapVoiceGenderToOpenAI(voiceGender?: string): 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' {
    switch (voiceGender?.toLowerCase()) {
      case 'male':
        return 'onyx'; // Deep male voice
      case 'female':
        return 'nova'; // Clear female voice
      case 'child':
        return 'shimmer'; // Lighter, younger-sounding voice
      default:
        return 'alloy'; // Default neutral voice
    }
  }

  // Method to clear voice cache when needed
  clearCache(): void {
    clearVoiceCache();
    console.log("Voice generation cache cleared");
  }
}
