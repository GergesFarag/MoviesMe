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

    let url = `${baseURL}/bytedance/seedream-v4/sequential`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      output_format: "jpeg",
      max_images: 1,
      size: "2048*2048",
      prompt: finalDescription,
    };

    const resultUrl = (await wavespeedBase(url, headers, payload)) as string;
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

    const resultUrl = (await wavespeedBase(url, headers, payload)) as string;
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
    seedreamPrompt: string,
    numOfScenes: number,
    refImages?: string[]
  ): Promise<any> {
    let url = "";
    if (!refImages) {
      url = `${baseURL}/bytedance/seedream-v4/sequential`;
    } else {
      url = `${baseURL}/bytedance/seedream-v4/edit-sequential`;
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      max_images: numOfScenes,
      prompt: seedreamPrompt,
      size: "2048*2048",
    };
    if (refImages) {
      Object.assign(payload, { images: refImages });
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        const requestId = result.data.id;
        console.log(`Task submitted successfully. Request ID: ${requestId}`);

        while (true) {
          const response = await fetch(
            `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
            {
              headers: {
                Authorization: `Bearer ${WAVESPEED_API_KEY}`,
              },
            }
          );
          const result = await response.json();

          if (response.ok) {
            const data = result.data;
            const status = data.status;
            if (status === "completed") {
              const resultUrls = data.outputs;
              console.log("Task completed. URLs:", resultUrls);
              return resultUrls;
              break;
            } else if (status === "failed") {
              console.error("Task failed:", data.error);
              break;
            } else {
              console.log("Task still processing. Status:", status);
            }
          } else {
            console.error("Error:", response.status, JSON.stringify(result));
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 0.1 * 1000));
        }
      } else {
        console.error(`Error: ${response.status}, ${await response.text()}`);
      }
    } catch (error) {
      console.error(`Request failed: ${error}`);
    }
  }
}
