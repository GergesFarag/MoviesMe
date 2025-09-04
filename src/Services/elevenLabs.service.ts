import { IStoryRequest } from "../Interfaces/storyRequest.interface";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getVoiceId } from "../Utils/Database/optimizedOps";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
export class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor() {
    this.client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
  }

  async generateVoiceOver(
    data: IStoryRequest["voiceOver"]
  ): Promise<ReadableStream<Uint8Array<ArrayBufferLike>>> {
    const voiceId = await getVoiceId(data!.voiceGender);
    if (!voiceId) throw new AppError("No voiceId found", HTTP_STATUS_CODE.NOT_FOUND);
    const audio = await this.client.textToSpeech.convert(
      voiceId,
      {
        text: data?.voiceOverLyrics as string,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
      }
    );
    return audio;
  }
}
