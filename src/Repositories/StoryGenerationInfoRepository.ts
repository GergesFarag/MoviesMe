import { IStoryGenerationInfo } from '../Interfaces/storyGenerationInfo.interface';
import StoryGenerationInfo from '../Models/storyGenerationInfo.model';
import { BaseRepository } from './BaseRepository';

export class StoryGenerationInfoRepository extends BaseRepository<IStoryGenerationInfo> {
  private static instance: StoryGenerationInfoRepository;

  private constructor() {
    super(StoryGenerationInfo);
  }

  public static getInstance(): StoryGenerationInfoRepository {
    if (!StoryGenerationInfoRepository.instance) {
      StoryGenerationInfoRepository.instance =
        new StoryGenerationInfoRepository();
    }
    return StoryGenerationInfoRepository.instance;
  }

  async getStoryGenerationInfo(): Promise<IStoryGenerationInfo | null> {
    return this.findOne({});
  }

  async updateStoryGenerationInfo(
    update: Partial<IStoryGenerationInfo>
  ): Promise<IStoryGenerationInfo | null> {
    const info = await this.getStoryGenerationInfo();
    if (!info) {
      return null;
    }
    return this.model.findOneAndUpdate({}, update, {
      new: true,
      runValidators: true,
    });
  }

  async getLocationName(locationId?: string): Promise<string | undefined> {
    if (!locationId) return undefined;
    const generationData = await this.getStoryGenerationInfo();
    return generationData?.location.find(
      (loc: any) => loc._id?.toString() === locationId
    )?.name;
  }

  async getStyleName(styleId?: string): Promise<string | undefined> {
    if (!styleId) return undefined;
    const generationData = await this.getStoryGenerationInfo();
    return generationData?.style.find(
      (sty: any) => sty._id?.toString() === styleId
    )?.name;
  }

  async checkGenreExists(genre: string): Promise<boolean> {
    const generationData = await this.getStoryGenerationInfo();
    return generationData?.genres.includes(genre.toLowerCase()) || false;
  }
}
