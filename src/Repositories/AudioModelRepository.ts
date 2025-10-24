import { IAudioModel } from '../Interfaces/audioModel.interface';
import AudioModel from '../Models/audio.model';
import { BaseRepository } from './BaseRepository';
import AppError from '../Utils/Errors/AppError';
import { HTTP_STATUS_CODE } from '../Enums/error.enum';
export class AudioModelRepository extends BaseRepository<IAudioModel> {
  private static instance: AudioModelRepository;

  private constructor() {
    super(AudioModel);
  }

  public static getInstance(): AudioModelRepository {
    if (!AudioModelRepository.instance) {
      AudioModelRepository.instance = new AudioModelRepository();
    }
    return AudioModelRepository.instance;
  }

  async findByLanguage(language: string): Promise<IAudioModel[]> {
    return this.model.find({ language }).lean().exec();
  }

  async findByGender(
    gender: 'male' | 'female' | 'kid'
  ): Promise<IAudioModel[]> {
    return this.model.find({ gender }).lean().exec();
  }

  async findByElevenLabsId(elevenLabsId: string): Promise<IAudioModel | null> {
    return this.findOne({ elevenLabsId });
  }

  async findByLanguageAndGender(
    language: string,
    gender: 'male' | 'female' | 'kid'
  ): Promise<IAudioModel[]> {
    return this.model.find({ language, gender }).lean().exec();
  }

  async findAll(): Promise<IAudioModel[]> {
    return this.model.find({}).lean().exec();
  }

  async getVoiceName(
    voiceGender: 'male' | 'female' | 'kid'
  ): Promise<string | null> {
    const item = await this.findOne({ gender: voiceGender });
    if (!item) {
      throw new AppError('No audio model found', HTTP_STATUS_CODE.NOT_FOUND);
    }
    return item.name || null;
  }

  async getVoiceElevenLabsId(
    voiceGender: string,
    voiceLanguage: string,
    voiceAccent: string | null
  ): Promise<string> {
    console.log('Voice Data', voiceGender, voiceLanguage, voiceAccent);

    // Default to English if not supported
    if (voiceLanguage !== '68d963ffbf1a7f7cdefb689a') {
      voiceLanguage = '68d963ffbf1a7f7cdefb6897';
    }

    const items = await this.findByLanguage(voiceLanguage);
    if (!items || items.length === 0) {
      throw new AppError(
        'No audio models found for this language',
        HTTP_STATUS_CODE.NOT_FOUND
      );
    }

    const filteredItems = items.filter(
      (item) => item.accent === voiceAccent && item.gender === voiceGender
    );

    if (!filteredItems || filteredItems.length === 0) {
      throw new AppError(
        'No audio models found for this voice accent or gender',
        HTTP_STATUS_CODE.NOT_FOUND
      );
    }

    return filteredItems[0].elevenLabsId;
  }
}
