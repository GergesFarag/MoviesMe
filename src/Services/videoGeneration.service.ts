import { wavespeedBase } from "../Utils/APIs/wavespeed_base";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";

export class VideoGenerationService {

  async generateImageFromDescription(
    imageDescription: string,
    refImageUrl?: string
  ): Promise<string> {
    const url = "https://api.wavespeed.ai/api/v3/bytedance/seedream-v3";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      guidance_scale: 2.5,
      output_format: "jpeg",
      prompt: imageDescription,
    };
    if (refImageUrl) {
      Object.assign(payload, { image: refImageUrl });
    }
    const resultUrl = await wavespeedBase(url, headers, payload);
    return resultUrl;
  }
}
