import { Images } from "openai/resources/images";
import { IScene } from "../Interfaces/scene.interface";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";
import { Validator } from "./validation.service";
import AppError from "../Utils/Errors/AppError";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";

export class ImageGenerationService {
  private enableContentSanitization: boolean;
  private validator: Validator;
  constructor(enableContentSanitization: boolean = true) {
    this.enableContentSanitization = enableContentSanitization;
    this.validator = new Validator();
  }

  async generateImageFromDescription(
    imageDescription: string
  ): Promise<string> {
    const finalDescription = this.enableContentSanitization
      ? this.validator.TextValidator.sanitizeImageDescription(imageDescription)
      : imageDescription;

    let url = `${baseURL}/google/nano-banana/text-to-image`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      output_format: "jpeg",
      prompt: finalDescription,
    };

    const resultUrl = await wavespeedBase(url, headers, payload) as string;
    if (!resultUrl) {
      throw new Error(
        `Failed to generate image from description: ${finalDescription}`
      );
    }
    return resultUrl;
  }

  async generateImageFromRefImage(
    refImage: string,
    imageDescription: string
  ): Promise<string> {
    const finalDescription = this.enableContentSanitization
      ? this.validator.TextValidator.sanitizeImageDescription(imageDescription)
      : imageDescription;

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
      prompt: finalDescription,
    };

    const resultUrl = await wavespeedBase(url, headers, payload) as string;
    if (!resultUrl) {
      throw new Error(
        `Failed to generate image from reference image: ${finalDescription}`
      );
    }
    return resultUrl;
  }

  async generateImagesForScenes(
    scenes: IScene[],
    refImage: string,
    skipFirstIteration: boolean
  ): Promise<string[]> {
    const imageUrls: string[] = [];
    let currentRefImage = refImage;
    let scene = null;
    for (let i = 0; i < scenes.length; i++) {
      if (skipFirstIteration && i === 0) {
        imageUrls.push(refImage);
        continue;
      }
      scene = scenes[i];
      try {
        console.log(`Generating image for scene ${i + 1}/${scenes.length}`);
        console.log(
          `Original description: ${scene.imageDescription.substring(0, 100)}...`
        );

        const imageUrl = await this.generateImageFromRefImage(
          currentRefImage,
          scene.imageDescription
        );

        if (!imageUrl) {
          throw new Error(`Failed to generate image for scene ${i + 1}`);
        }

        imageUrls.push(imageUrl);
        currentRefImage = imageUrl;

        console.log(
          `Successfully generated image for scene ${i + 1}: ${imageUrl}`
        );
      } catch (error) {
        console.error(`Error generating image for scene ${i + 1}:`, error);
        throw new Error(
          `Failed to generate image for scene ${i + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return imageUrls;
  }

  async generateSeedreamImages(
    scenePrompt: string[],
    refImages?: string[]
  ): Promise<string[]> {
    const url = `${baseURL}/bytedance/seedream-v4/edit-sequential`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      images: refImages?.length !== 0 ? refImages : [],
      max_images: scenePrompt.length,
      prompt: scenePrompt.join(", "),
      size: "2048*2048",
    };
    const images = await wavespeedBase(url, headers, payload) as string[];
    if (!images || images.length === 0) {
      throw new AppError("Failed to generate seedream images");
    }
    return images;
  }
}
