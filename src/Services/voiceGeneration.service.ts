import { IStoryRequest } from '../Interfaces/storyRequest.interface';
import { AudioModelRepository } from '../Repositories/AudioModelRepository';
import AppError from '../Utils/Errors/AppError';
import { HTTP_STATUS_CODE } from '../Enums/error.enum';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {
  cloudUploadAudio,
  generateHashFromBuffer,
} from '../Utils/APIs/cloudinary';
import { streamToBuffer } from '../Utils/Format/streamToBuffer';
import { TextToSpeechRequest } from '@elevenlabs/elevenlabs-js/api';
import { CLOUDINAT_FOLDERS } from '../Constants/cloud';

const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY as string) || '';
export class VoiceGenerationService {
  private client: ElevenLabsClient;

  constructor() {
    try {
      // Validate API key exists
      if (!ELEVENLABS_API_KEY) {
        console.error('ELEVENLABS_API_KEY is not set in environment variables');
        throw new AppError(
          'ElevenLabs API key is not configured',
          HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
        );
      }

      // Log API key status (without exposing the key)
      console.log(
        'ElevenLabs API Key configured:',
        ELEVENLABS_API_KEY.substring(0, 10) + '...'
      );

      this.client = new ElevenLabsClient({
        apiKey: ELEVENLABS_API_KEY,
      });
    } catch (error) {
      console.error('ElevenLabs Client initialization error:', error);
      throw new AppError(
        'ElevenLabs Client initialization failed',
        HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }
  }

  async generateVoiceOver(
    data: IStoryRequest['voiceOver'],
    userId: string
  ): Promise<{ url: string; PID: string }> {
    let voiceId: string | null = null;
    console.log('voiceOverData: ', data);
    if (data?.voiceGender && data?.voiceLanguage) {
      const audioModelRepository = AudioModelRepository.getInstance();
      voiceId = await audioModelRepository.getVoiceElevenLabsId(
        data?.voiceGender,
        data?.voiceLanguage,
        data?.voiceAccent
      );
      if (!voiceId)
        throw new AppError('No voiceId found', HTTP_STATUS_CODE.NOT_FOUND);
    }
    console.log('voiceId: ', voiceId);
    if (!data?.text) {
      throw new AppError(
        'No voiceOverLyrics or narration provided',
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }
    try {
      const requestData: TextToSpeechRequest = {
        text: data!.text,
        modelId: 'eleven_v3',
        outputFormat: 'mp3_44100_128',
        voiceSettings: {
          stability: 0.5,
          speed: 1.1,
        },
      };
      const audio = await this.client.textToSpeech.convert(
        voiceId || 'UR972wNGq3zluze0LoIp',
        requestData
      );
      if (!audio) {
        throw new AppError(
          'Voice generation failed',
          HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
        );
      }
      const audioBuffer = await streamToBuffer(audio);
      const audioHash = generateHashFromBuffer(audioBuffer);
      const audioUrl = await cloudUploadAudio(
        audioBuffer,
        `user_${userId}/${CLOUDINAT_FOLDERS.GENERATED_VOICE}`,
        audioHash
      );
      return { url: audioUrl.secure_url, PID: audioUrl.public_id };
    } catch (error: any) {
      console.error('Voice generation error details:', {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        response: error.response?.data || error.body,
      });

      // Check if it's an API key related error
      if (
        error.message?.includes('invalid_api_key') ||
        error.status === 'invalid_api_key'
      ) {
        throw new AppError(
          'Voice generation failed: Invalid API key. Please check your ElevenLabs API key configuration.',
          HTTP_STATUS_CODE.UNAUTHORIZED
        );
      }
      throw new AppError(
        `Voice generation failed: ${error.message || 'Unknown error'}`,
        HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      );
    }
  }
}
