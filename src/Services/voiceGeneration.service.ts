import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getVoiceId } from "../Utils/Database/optimizedOps";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import { cloudUploadAudio } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { streamToBuffer } from "../Utils/Format/streamToBuffer";

const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY as string) || "";

export class VoiceGenerationService {
  private client: ElevenLabsClient;

  constructor() {
    try {
      this.client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
    } catch (error) {
      console.log("err" , error);
      throw new AppError(
        "ElevenLabs Client initialization failed",
        HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }
  }

  async generateVoiceOver(data: IStoryRequest["voiceOver"]): Promise<string> {
    let voiceId: string | null = null;
    if (data?.voiceGender) {
      voiceId = await getVoiceId(data!.voiceGender);
      if (!voiceId)
        throw new AppError("No voiceId found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    const audio = await this.client.textToSpeech.convert(
      voiceId || "CwhRBWXzGAHq8TQ4Fs17",
      {
        text: data?.voiceOverLyrics as string,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
      }
    );

    const audioBuffer = await streamToBuffer(audio);

    return (await cloudUploadAudio(audioBuffer)).secure_url;
  }
}
