import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getVoiceId } from "../Utils/Database/optimizedOps";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import { cloudUploadAudio } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { streamToBuffer } from "../Utils/Format/streamToBuffer";
import { getCachedVoice, setCachedVoice } from "../Utils/Cache/voiceCache";

const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY as string) || "";

// Rate limiting for ElevenLabs API calls
class ElevenLabsRateLimiter {
  private lastCallTime: number = 0;
  private readonly minInterval: number;

  constructor() {
    // Allow configurable rate limiting via environment variable (default: 2 seconds)
    this.minInterval = parseInt(process.env.ELEVENLABS_RATE_LIMIT_MS || "2000", 10);
    console.log(`ElevenLabs rate limiter initialized with ${this.minInterval}ms interval`);
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
      this.client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
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
    
    console.log(`Generating voice with ElevenLabs - Voice: ${data?.voiceGender}, Text length: ${data?.voiceOverLyrics?.length}`);
    
    try {
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
      
      console.log("ElevenLabs voice generation completed successfully");
      return uploadResult.secure_url;
    } catch (error: any) {
      console.error("ElevenLabs API Error:", error);
      if (error.message?.includes("unusual activity") || error.message?.includes("Free Tier")) {
        throw new AppError(
          "ElevenLabs usage limit reached. Please try again later or upgrade to a paid plan.",
          HTTP_STATUS_CODE.TOO_MANY_REQUESTS
        );
      }
      throw new AppError(
        "Voice generation failed",
        HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }
  }
}
