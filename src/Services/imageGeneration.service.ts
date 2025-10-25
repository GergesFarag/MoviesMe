import { Images } from "openai/resources/images";
import { IScene } from "../Interfaces/scene.interface";
import {
  wavespeedBase,
  wavespeedBaseOptimized,
} from "../Utils/APIs/wavespeed_base";
import { Validator } from "./validation.service";
import AppError from "../Utils/Errors/AppError";
import { IGenerationImageLibModel } from "../Interfaces/aiModel.interface";
import { constructImageGenerationPayload } from "../Utils/Model/model.utils";

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

    // Use optimized polling for better performance
    const resultUrl = (await wavespeedBaseOptimized(
      url,
      headers,
      payload
    )) as string;
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

    // Use optimized polling for better performance
    const resultUrl = (await wavespeedBaseOptimized(
      url,
      headers,
      payload
    )) as string;
    if (!resultUrl) {
      throw new Error(
        `Failed to generate image from reference image: ${finalDescription}`
      );
    }
    return resultUrl;
  }

  // async generateImagesForScenes(
  //   scenes: IScene[],
  //   refImage: string,
  //   skipFirstIteration: boolean
  // ): Promise<string[]> {
  //   const imageUrls: string[] = [];
  //   let currentRefImage = refImage;
  //   let scene = null;
  //   for (let i = 0; i < scenes.length; i++) {
  //     if (skipFirstIteration && i === 0) {
  //       imageUrls.push(refImage);
  //       continue;
  //     }
  //     scene = scenes[i];
  //     try {
  //       console.log(`Generating image for scene ${i + 1}/${scenes.length}`);
  //       console.log(
  //         `Original description: ${scene.imageDescription.substring(0, 100)}...`
  //       );

  //       const imageUrl = await this.generateImageFromRefImage(
  //         currentRefImage,
  //         scene.imageDescription
  //       );

  //       if (!imageUrl) {
  //         throw new Error(`Failed to generate image for scene ${i + 1}`);
  //       }

  //       imageUrls.push(imageUrl);
  //       currentRefImage = imageUrl;

  //       console.log(
  //         `Successfully generated image for scene ${i + 1}: ${imageUrl}`
  //       );
  //     } catch (error) {
  //       console.error(`Error generating image for scene ${i + 1}:`, error);
  //       throw new Error(
  //         `Failed to generate image for scene ${i + 1}: ${
  //           error instanceof Error ? error.message : "Unknown error"
  //         }`
  //       );
  //     }
  //   }

  //   return imageUrls;
  // }

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
      console.log(
        `🎨 Starting optimized image generation for ${numOfScenes} scenes...`
      );

      // Use the optimized polling mechanism instead of custom implementation
      const resultUrls = (await wavespeedBaseOptimized(
        url,
        headers,
        payload,
        true
      )) as string[];

      if (!resultUrls || !Array.isArray(resultUrls)) {
        console.error("❌ Invalid response from image generation API");
        throw new AppError("Invalid response from image generation API", 500);
      }

      if (resultUrls.length !== numOfScenes) {
        console.error(
          `❌ Expected ${numOfScenes} images, received ${resultUrls.length}`
        );
        throw new AppError(
          `Image generation returned wrong number of images. Expected: ${numOfScenes}, Got: ${resultUrls.length}`,
          500
        );
      }

      console.log(
        `✅ Successfully generated ${resultUrls.length} images with optimized polling`
      );
      return resultUrls;
    } catch (error) {
      console.error(`❌ Optimized image generation failed:`, error);

      // Fallback to original implementation if optimized version fails
      console.log("🔄 Falling back to original polling implementation...");
      return await this.generateSeedreamImagesLegacy(
        seedreamPrompt,
        numOfScenes,
        refImages
      );
    }
  }

  private async generateSeedreamImagesLegacy(
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
      console.log("🔄 Using legacy polling implementation...");

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
              console.log("✅ Legacy polling completed. URLs:", resultUrls);
              return resultUrls;
            } else if (status === "failed") {
              console.error("❌ Legacy polling - Task failed:", data.error);
              throw new AppError("Legacy image generation failed", 500);
            }
          } else {
            console.error(
              "❌ Legacy polling error:",
              response.status,
              JSON.stringify(result)
            );
            throw new AppError(
              `Legacy polling status check failed: ${response.status}`,
              500
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 2000)); // Original 2-second interval
        }
      } else {
        const errorText = await response.text();
        console.error(
          `❌ Legacy polling - Initial request failed: ${response.status}, ${errorText}`
        );
        throw new AppError(
          `Legacy image generation request failed: ${response.status}`,
          500
        );
      }
    } catch (error) {
      console.error(`❌ Legacy image generation failed:`, error);
      throw error;
    }
  }

  async generateForGenerationLib(
    model: IGenerationImageLibModel,
    prompt?: string,
    refImages?: string[]
  ): Promise<string> {

    const { url, payload } = constructImageGenerationPayload(
      model,
      prompt,
      refImages
    );
    console.log("Payload for GenerationLib:", payload);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };

    try {
      console.log(
        `🎨 Starting generation for generationLib with prompt: ${prompt!.substring(
          0,
          100
        )}...`
      );

      const resultUrl = (await wavespeedBaseOptimized(
        url,
        headers,
        payload
      )) as string;

      if (!resultUrl) {
        throw new AppError(
          `Failed to generate image for generationLib: ${prompt}`,
          500
        );
      }

      console.log(
        `✅ Successfully generated image for generationLib: ${resultUrl}`
      );
      return resultUrl;
    } catch (error) {
      console.error(`❌ GenerationLib image generation failed:`, error);
      throw new AppError(
        `GenerationLib generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500
      );
    }
  }
}
