import { IScene } from "../Interfaces/scene.interface";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";
export class ImageGenerationService {
  async generateImageFromDescription(
    imageDescription: string,
    refImageUrl?: string
  ): Promise<string> {
    let url = `${baseURL}/google/nano-banana/text-to-image`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      output_format: "png",
      prompt: imageDescription,
    };
    if (refImageUrl) {
      Object.assign(payload, { image: refImageUrl });
      url = `${baseURL}/google/nano-banana/edit`;
    }
    const resultUrl = await wavespeedBase(url, headers, payload);
    return resultUrl;
  }
}
