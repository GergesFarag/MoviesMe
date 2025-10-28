import logger from '../../Config/logger';
import IAiModel from '../../Interfaces/aiModel.interface';
import { getIO } from '../../Sockets/socket';
import { wavespeedBase } from '../../Utils/APIs/wavespeed_base';
import AppError from '../../Utils/Errors/AppError';
import {
  filterModelType,
  ModelType,
  reverseModelTypeMapper,
} from '../../Utils/Format/filterModelType';
import { updateJobProgress } from '../../Utils/Model/model.utils';
import {
  EffectsPayloadBuilderParams,
  PayloadBuilder,
} from '../../Utils/Model/payloadBuilder';
export interface EffectProcessorOutputData {
  userId: string;
  modelType: ModelType;
  resultURL: string | string[];
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  effectThumbnail: string;
  jobId: string;
  duration: number;
}
export class EffectProcessorService {
  private WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;
  private static intance: EffectProcessorService;
  private constructor() {}
  static getInstance() {
    if (!EffectProcessorService.intance) {
      this.intance = new EffectProcessorService();
    }
    return this.intance;
  }
  async processEffect(job: any): Promise<any> {
    try {
      const { modelData, userId, data, prompt } = job.data;
      if (!modelData) {
        throw new AppError('Model Data not found', 404);
      }
      // Cache IO instance to prevent repeated getIO() calls
      const io = getIO();
      let progress = 0;
      const intervalId = setInterval(async () => {
        if (job && progress < 95) {
          console.log('Sending Progress...');
          progress += 2;
          await updateJobProgress(
            job,
            progress,
            'Still processing...',
            io,
            'job:progress'
          );
        }
      }, 3000); // Reduced frequency from 2s to 3s
      if (!this.WAVESPEED_API_KEY) {
        console.error(
          'Your API_KEY is not set, you can check it in Access Keys'
        );
        throw new AppError('WAVESPEED_API_KEY is not set', 500);
      }
      const url = `https://api.wavespeed.ai/api/v3/${modelData.wavespeedCall}`;
      logger.info({ url });
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.WAVESPEED_API_KEY}`,
      };
      const params: EffectsPayloadBuilderParams = {
        images: data.images ? data.images : [data.image],
        maxImages: modelData.maxImages,
        size: data.size,
        prompt: prompt,
        duration: modelData.duration,
      };
      const payload = PayloadBuilder.buildEffectsPayload(params);
      console.log('Model DData', modelData);
      let modelType = filterModelType(modelData as IAiModel);
      modelType = reverseModelTypeMapper[modelType];
      console.log('Model Type', modelType);
      if (!modelType) {
        throw new AppError('Invalid model type', 400);
      }
      console.log('PAYLOAD:', payload);
      const result = await wavespeedBase(url, headers, payload);
      clearInterval(intervalId);
      if (!result) {
        throw new AppError('Model processing Result Failed', 500);
      }
      const effectThumbnail = modelData.isVideo ? modelData.thumbnail : result;

      const dataToBeSent: EffectProcessorOutputData = {
        userId,
        modelType: modelType as ModelType,
        resultURL: result,
        modelName: modelData.name,
        isVideo: modelData.isVideo,
        modelThumbnail: modelData.thumbnail,
        effectThumbnail,
        jobId: job.id,
        duration: modelData.isVideo ? 0 : 0,
      };
      updateJobProgress(job, 100, 'Processing completed', io, 'job:progress');
      return dataToBeSent;
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }
}
