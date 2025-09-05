import { wavespeedBase } from "../Utils/APIs/wavespeed_base";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";

export class VideoGenerationService {
  
  async generateVideoFromDescription(
    videoDescription: string,
    refImageUrl: string,
    duration: number
  ): Promise<string> {
    let url = `${baseURL}/bytedance/seedance-v1-lite-i2v-480p`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      duration,
      image: refImageUrl,
      prompt: videoDescription,
      seed: -1,
    };
    const resultUrl = await wavespeedBase(url, headers, payload);
    return resultUrl;
  }
}
