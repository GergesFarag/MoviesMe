import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getVoiceId } from "../Utils/Database/optimizedOps";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import { cloudUploadAudio } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { streamToBuffer } from "../Utils/Format/streamToBuffer";
import { getCachedVoice, setCachedVoice } from "../Utils/Cache/voiceCache";

const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY as string) || "";
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Rate limiting for ElevenLabs API calls
class ElevenLabsRateLimiter {
  private lastCallTime: number = 0;
  private readonly minInterval: number;

  constructor() {
    // More conservative rate limiting for cloud environments (default: 5 seconds)
    // Render and other cloud services need longer delays to avoid abuse detection
    const baseInterval = IS_PRODUCTION ? "10000" : "40000";
    this.minInterval = parseInt(process.env.ELEVENLABS_RATE_LIMIT_MS || baseInterval, 10);
    console.log(`ElevenLabs rate limiter initialized with ${this.minInterval}ms interval (Production: ${IS_PRODUCTION})`);
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

  constructor() {
    try {
      this.client = new ElevenLabsClient({ 
        apiKey: ELEVENLABS_API_KEY,
      });
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
    narration?: string
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
    
    // Check cache first
    const cachedAudio = getCachedVoice(data!.voiceOverLyrics, finalVoiceId);
    if (cachedAudio) {
      console.log("Using cached voice generation");
      return cachedAudio;
    }
    
    // Apply rate limiting for new API calls
    await rateLimiter.waitForNextCall();
    
    console.log(`Generating voice with ElevenLabs - Voice: ${data?.voiceGender}, Text length: ${data?.voiceOverLyrics?.length}, Environment: ${IS_PRODUCTION ? 'Production' : 'Development'}`);
    
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
        
        if (error.message?.includes("unusual activity") || error.message?.includes("Free Tier")) {
          if (attempt === maxRetries) {
            throw new AppError(
              "ElevenLabs detected unusual activity from this server. This commonly happens with cloud hosting services like Render. Consider upgrading to a paid ElevenLabs plan or implementing IP rotation.",
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
}
