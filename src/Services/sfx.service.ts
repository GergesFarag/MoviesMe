import { wavespeedBase } from '../Utils/APIs/wavespeed_base';
import AppError from '../Utils/Errors/AppError';

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || '';
const baseURL = 'https://api.wavespeed.ai/api/v3';

export class SFXService {
  constructor() {}

  async generateSFXForVideos(
    videoUrls: string[],
    prompt?: string
  ): Promise<string[]> {
    try {
      const sfxPromises = videoUrls.map((videoUrl) =>
        this.addSFX(videoUrl, prompt)
      );
      const sfxUrls = await Promise.all(sfxPromises);

      console.log(`✅ SFX generated for all ${videoUrls.length} videos`);
      return sfxUrls;
    } catch (error) {
      console.error('Error generating SFX for videos:', error);
      throw new AppError(
        `SFX generation failed for videos: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        500
      );
    }
  }

  private async addSFX(videoUrl: string, prompt?: string): Promise<string> {
    const url = `${baseURL}/wavespeed-ai/hunyuan-video-foley`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload: any = {
      video: videoUrl,
    };

    if (prompt) {
      payload.prompt = prompt;
    }

    console.log('Payload for SFX generation:', payload);

    try {
      console.log(`🎵 Starting SFX generation from video...`);

      const resultUrl = (await wavespeedBase(url, headers, payload)) as string;

      if (!resultUrl) {
        throw new AppError('Failed to generate SFX from video', 500);
      }

      console.log(`✅ SFX generated successfully: ${resultUrl}`);
      return resultUrl;
    } catch (error) {
      console.error('Error generating SFX:', error);
      throw new AppError(
        `SFX generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        500
      );
    }
  }
}
