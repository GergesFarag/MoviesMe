import { IGenerationInfo } from '../Interfaces/generationInfo.interface';
import GenerationInfo from '../Models/generation.model';
import { BaseRepository } from './BaseRepository';

export class GenerationInfoRepository extends BaseRepository<IGenerationInfo> {
  private static instance: GenerationInfoRepository;

  private constructor() {
    super(GenerationInfo);
  }

  public static getInstance(): GenerationInfoRepository {
    if (!GenerationInfoRepository.instance) {
      GenerationInfoRepository.instance = new GenerationInfoRepository();
    }
    return GenerationInfoRepository.instance;
  }

  async getGenerationInfo(): Promise<IGenerationInfo | null> {
    return this.findOne({});
  }
  async getGenerationInfoDocs() {
    return this.model.findOne();
  }
  async updateGenerationInfo(
    update: Partial<IGenerationInfo>
  ): Promise<IGenerationInfo | null> {
    const info = await this.getGenerationInfo();
    if (!info) {
      return null;
    }
    console.log('Updates:', update);
    return this.model.findByIdAndUpdate(info._id, update, {
      new: true,
      runValidators: true,
    });
  }
}
