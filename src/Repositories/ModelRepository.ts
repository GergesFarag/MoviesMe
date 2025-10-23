import IAiModel, { TModelCategory } from '../Interfaces/aiModel.interface';
import Model from '../Models/ai.model';
import { BaseRepository } from './BaseRepository';
import { FilterQuery } from 'mongoose';
import AppError, { HTTP_STATUS_CODE } from '../Utils/Errors/AppError';

export class ModelRepository extends BaseRepository<IAiModel> {
  private static instance: ModelRepository;

  private constructor() {
    super(Model);
  }

  public static getInstance(): ModelRepository {
    if (!ModelRepository.instance) {
      ModelRepository.instance = new ModelRepository();
    }
    return ModelRepository.instance;
  }

  async findByCategory(category: TModelCategory): Promise<IAiModel[]> {
    return this.model.find({ category }).lean().exec();
  }

  async findTrendingModels(): Promise<IAiModel[]> {
    return this.model.find({ isTrending: true }).lean().exec();
  }

  async findNewModels(): Promise<IAiModel[]> {
    return this.model.find({ isNewModel: true }).lean().exec();
  }

  async findByFilter(filter: FilterQuery<IAiModel>): Promise<IAiModel[]> {
    return this.model.find(filter).lean().exec();
  }

  async updateModel(
    id: string,
    update: Partial<IAiModel>
  ): Promise<IAiModel | null> {
    return this.findByIdAndUpdate(id, update);
  }

  async getModelWavespeedCall(modelId: string): Promise<string | null> {
    const model = await this.findById(modelId);
    if (!model) {
      throw new AppError('No model found', HTTP_STATUS_CODE.NOT_FOUND);
    }
    return model.wavespeedCall || null;
  }
}
