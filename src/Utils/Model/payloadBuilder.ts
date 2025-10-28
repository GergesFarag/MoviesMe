import logger from '../../Config/logger';
import {
  IGenerationImageLibModel,
  IGenerationVideoLibModel,
} from '../../Interfaces/aiModel.interface';
import AppError from '../Errors/AppError';

export interface EffectsPayloadBuilderParams {
  prompt: string;
  images: string[];
  maxImages: number;
  size?: string;
  duration?: number;
  flags?: string[];
}

export interface GeneratedPayloadBuilderParams {
  isVideo: boolean;
  model: IGenerationVideoLibModel | IGenerationImageLibModel;
  prompt?: string;
  refImages?: string[];
  duration?: number;
}

export class PayloadBuilder {
  
  static buildGenerationPayload(
    params: GeneratedPayloadBuilderParams
  ): Record<string, any> {
    if (params.isVideo) {
      return this.buildVideoGenerationPayload(
        params.model as IGenerationVideoLibModel,
        params.prompt,
        params.refImages,
        params.duration
      );
    } else {
      return this.buildImageGenerationPayload(
        params.model as IGenerationImageLibModel,
        params.prompt,
        params.refImages
      );
    }
  }

  static buildEffectsPayload(
    params: EffectsPayloadBuilderParams
  ): Record<string, any> {
    const payload: Record<string, any> = {};
    this.addField(payload, 'prompt', params.prompt);
    this.addImagesField(payload, params.images, params.maxImages);
    this.addField(payload, 'size', params.size);
    this.addField(payload, 'duration', params.duration);
    this.addField(payload, 'flags', params.flags);

    return payload;
  }

  private static buildImageGenerationPayload(
    model: IGenerationImageLibModel,
    prompt?: string,
    refImages?: string[]
  ): Record<string, any> {
    const payload: Record<string, any> = { enable_base64_output: false };
    if (model.requirePrompt || (prompt && !model.requirePrompt)) {
      Object.assign(payload, { prompt });
    }
    if (refImages && refImages.length > 0 && model.maxImages !== 0) {
      if (refImages.length > model.maxImages) {
        throw new AppError(
          `Model supports a maximum of ${model.maxImages} reference images.`,
          400
        );
      }
      if (refImages.length < model.minImages) {
        throw new AppError(
          `Model requires at least ${model.minImages} reference image(s).`,
          400
        );
      }
      if (refImages.length === 1 && model.maxImages === 1) {
        this.addField(payload, 'image', refImages[0]);
      } else {
        this.addImagesField(payload, refImages, model.maxImages);
      }
    }
    return payload;
  }

  private static buildVideoGenerationPayload(
    model: IGenerationVideoLibModel,
    prompt?: string,
    refImages?: string[],
    duration?: number
  ): Record<string, any> {
    let payload: Record<string, any> = { enable_base64_output: false };
    payload = this.buildImageGenerationPayload(
      model as unknown as IGenerationImageLibModel,
      prompt,
      refImages
    );
    this.addField(payload, 'duration', duration || 5);
    return payload;
  }

  private static addField(
    payload: Record<string, any>,
    key: string,
    value: any,
    condition: boolean = true
  ) {
    if (value !== undefined && value !== null && condition) {
      payload[key] = value;
    }
  }

  private static addImagesField(
    payload: Record<string, any>,
    images: string[],
    maxImages: number
  ) {
    if (images.length === 1 && maxImages === 1) {
      payload['image'] = images[0];
    } else if (images.length > 0) {
      payload['images'] = images;
    }
  }
}
