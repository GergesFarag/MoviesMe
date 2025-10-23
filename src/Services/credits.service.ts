import { ICreditService } from '../Interfaces/credits.model';
import { MAX_CREDITS_AMT, MIN_CREDITS_AMT } from '../Constants/credits';
import AppError, { HTTP_STATUS_CODE } from '../Utils/Errors/AppError';
import { UserRepository } from '../Repositories/UserRepository';
import { ModelRepository } from '../Repositories/ModelRepository';
import { GenerationInfoRepository } from '../Repositories/GenerationInfoRepository';
import { StoryGenerationInfoRepository } from '../Repositories/StoryGenerationInfoRepository';

export class CreditService implements ICreditService {
  private static instance: CreditService;
  private userRepository: UserRepository;
  private modelRepository: ModelRepository;
  private generationInfoRepository: GenerationInfoRepository;
  private storyGenerationInfoRepository: StoryGenerationInfoRepository;

  private constructor() {
    this.userRepository = UserRepository.getInstance();
    this.modelRepository = ModelRepository.getInstance();
    this.generationInfoRepository = GenerationInfoRepository.getInstance();
    this.storyGenerationInfoRepository =
      StoryGenerationInfoRepository.getInstance();
  }

  public static getInstance(): CreditService {
    if (!CreditService.instance) {
      CreditService.instance = new CreditService();
    }
    return CreditService.instance;
  }
  async addCredits(userId: string, credits: number): Promise<boolean> {
    try {
      if (credits < MIN_CREDITS_AMT || credits > MAX_CREDITS_AMT) {
        throw new AppError(
          'Invalid credit amount',
          HTTP_STATUS_CODE.BAD_REQUEST
        );
      }
      console.log('Adding Credits ', credits, 'To User ', userId);
      const user = await this.userRepository.findByIdAndUpdate(userId, {
        $inc: { credits: credits },
      });
      if (!user) {
        throw new AppError('User not found', HTTP_STATUS_CODE.NOT_FOUND);
      }
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(`${error.message}`);
      } else {
        throw new AppError(`Failed to add credits: ${error}`);
      }
    }
  }

  async deductCredits(userId: string, credits: number): Promise<boolean> {
    console.log('Triggered');
    try {
      if (credits < MIN_CREDITS_AMT || credits > MAX_CREDITS_AMT) {
        throw new AppError('Invalid credit amount');
      }
      const user = await this.userRepository.findByIdAndUpdate(userId, {
        $inc: { credits: -credits },
      });
      if (!user) {
        throw new AppError('User not found');
      }
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(`${error.message}`);
      } else {
        throw new AppError(`Failed to deduct credits: ${error}`);
      }
    }
  }

  async getCredits(userId: string): Promise<number> {
    console.log("UserId" , userId);
    const user = await this.userRepository.findById(userId, 'credits');
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS_CODE.NOT_FOUND);
    }
    return user.credits;
  }

  async hasSufficientCredits(
    userId: string,
    credits: number
  ): Promise<boolean> {
    const currentCredits = await this.getCredits(userId);
    return currentCredits >= credits;
  }

  async getModelCredits(modelId: string): Promise<number> {
    const model = await this.modelRepository.findById(modelId);
    if (!model) {
      throw new AppError('Model not found', HTTP_STATUS_CODE.NOT_FOUND);
    }
    return model.credits;
  }

  async getGenerationModelCredits(
    modelId: string,
    isVideo: boolean = false
  ): Promise<number | Map<string, number>[]> {
    const generationInfo =
      await this.generationInfoRepository.getGenerationInfo();
    if (!generationInfo || !generationInfo.videoModels) {
      throw new AppError(
        'Generation info not found',
        HTTP_STATUS_CODE.NOT_FOUND
      );
    }
    if (isVideo) {
      const videoModel = generationInfo.videoModels.find(
        (m) => m._id.toString() === modelId.toString()
      );
      if (!videoModel) {
        throw new AppError('Video Model not found', HTTP_STATUS_CODE.NOT_FOUND);
      }
      const credits: Map<string, number>[] = videoModel.credits.map(
        (creditMap) => {
          return new Map(Object.entries(creditMap));
        }
      );
      return credits;
    } else {
      const imageModel = generationInfo.imageModels.find(
        (m) => m._id.toString() === modelId.toString()
      );
      if (!imageModel) {
        throw new AppError('Image Model not found', HTTP_STATUS_CODE.NOT_FOUND);
      }
      return imageModel.credits;
    }
  }

  async getStoryCredits(
    numOfScenes: number,
    hasVoiceOver: boolean = false
  ): Promise<number> {
    const storyGenerationInfo =
      await this.storyGenerationInfoRepository.getStoryGenerationInfo();
    if (!storyGenerationInfo) {
      throw new AppError(
        'Story Generation info not found',
        HTTP_STATUS_CODE.NOT_FOUND
      );
    }
    if (numOfScenes <= 0) {
      throw new AppError(
        'Number of scenes must be greater than zero',
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }
    let totalCredits = 0;
    totalCredits += storyGenerationInfo.generationCredits * numOfScenes;
    if (hasVoiceOver) {
      totalCredits += storyGenerationInfo.voiceOverCredits * numOfScenes;
    }
    return totalCredits;
  }

  isValidCredits(credits: number, calculatedCredits: number): boolean {
    console.log('Credits', credits, 'Calculated Credits', calculatedCredits);
    return credits === calculatedCredits;
  }
}
