import { Images } from "openai/resources/images";
import { IScene } from "../Interfaces/scene.interface";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";
export class ImageGenerationService {
  async generateImageFromDescription(
    imageDescription: string
  ): Promise<string> {
    let url = `${baseURL}/google/nano-banana/text-to-image`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      output_format: "jpeg",
      prompt: imageDescription,
    };

    const resultUrl = await wavespeedBase(url, headers, payload);
    if (!resultUrl) {
      throw new Error(`Failed to generate image from description: ${imageDescription}`);
    }
    return resultUrl;
  }

  async generateImageFromRefImage(
    refImage: string,
    imageDescription: string
  ): Promise<string> {
    let url = `${baseURL}/google/nano-banana/edit`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      output_format: "jpeg",
      images: [refImage],
      prompt: imageDescription,
    };

    const resultUrl = await wavespeedBase(url, headers, payload);
    if (!resultUrl) {
      throw new Error(`Failed to generate image from reference image: ${imageDescription}`);
    }
    return resultUrl;
  }

  async generateImagesForScenes(
    scenes: IScene[],
    refImage: string,
    skipFirstImage: boolean
  ): Promise<string[]> {
    const imageUrls: string[] = [];
    let currentRefImage = refImage;
    let scene = null;
    for (let i = 0; i < scenes.length; i++) {
      scene = scenes[i];
      try {
        if(skipFirstImage && i === 0) {
          console.log(`Skipping image generation for first scene as per flag. Using provided reference image.`);
          imageUrls.push(currentRefImage);
          continue;
        }
        console.log(`Generating image for scene ${i + 1}/${scenes.length}: ${scene.imageDescription.substring(0, 100)}...`);
        
        const imageUrl = await this.generateImageFromRefImage(
          currentRefImage,
          scene.imageDescription
        );
        
        if (!imageUrl) {
          throw new Error(`Failed to generate image for scene ${i + 1}`);
        }
        
        imageUrls.push(imageUrl);
        currentRefImage = imageUrl;
        
        console.log(`Successfully generated image for scene ${i + 1}: ${imageUrl}`);
      } catch (error) {
        console.error(`Error generating image for scene ${i + 1}:`, error);
        throw new Error(`Failed to generate image for scene ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return imageUrls;
  }
}
