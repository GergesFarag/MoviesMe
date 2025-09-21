import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import {getVoiceName } from "../Utils/Database/optimizedOps";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import {
  getCachedVoice,
  setCachedVoice,
  clearVoiceCache,
} from "../Utils/Cache/voiceCache";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";
import { Readable } from "stream";
import { downloadFile } from "../Utils/Format/downloadFile";
import { language } from "@elevenlabs/elevenlabs-js/api/resources/dubbing/resources/resource";

// const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY as string) || "";
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;
export class VoiceGenerationService {
  // private client: ElevenLabsClient;

  constructor() {
    // try {
    //   this.client = new ElevenLabsClient({
    //     apiKey: ELEVENLABS_API_KEY,
    //   });
    // } catch (error) {
    //   console.log("err", error);
    //   throw new AppError(
    //     "ElevenLabs Client initialization failed",
    //     HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
    //   );
    // }
  }

  async generateVoiceOver(
    data: IStoryRequest["voiceOver"]
  ): Promise<string> {
    let voiceId: string | null = null;
    if (data?.voiceGender) {
      voiceId = await getVoiceName(data!.voiceGender);
      if (!voiceId)
        throw new AppError("No voiceId found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    if (!data?.text) {
      throw new AppError(
        "No voiceOverLyrics or narration provided",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }
    const cachedAudio = getCachedVoice(data!.text, voiceId as string);
    if (cachedAudio) {
      console.log("Using cached voice generation");
      return cachedAudio;
    }
    try {
      const url = "https://api.wavespeed.ai/api/v3/minimax/speech-02-hd";
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WAVESPEED_API_KEY}`,
      };
      const payload = {
        text: data!.text,
        voice_id: voiceId || "Friendly_Person",
        speed: 1.20,
      };
      const audio = await wavespeedBase(url, headers, payload) as string;
      if (!audio) {
        throw new AppError(
          "Voice generation failed",
          HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
        );
      }
      setCachedVoice(
        data!.text,
        voiceId as string,
        audio
      );

      return audio;
    } catch (error: any) {
      throw new AppError(
        `Voice generation failed: ${error.message || "Unknown error"}`,
        HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }
  }

  clearCache(): void {
    clearVoiceCache();
    console.log("Voice generation cache cleared");
  }
}
