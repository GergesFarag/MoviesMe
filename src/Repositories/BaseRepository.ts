import { FilterQuery, Model, QueryOptions, UpdateQuery } from 'mongoose';

export abstract class BaseRepository<T> {
  constructor(protected model: Model<T>) {}

  async findById(id: string, select: string = ''): Promise<T | null> {
    return this.model.findById(id).select(select).lean().exec() as T | null;
  }

  async findOne(query: FilterQuery<T>, select: string = ''): Promise<T | null> {
    return this.model.findOne(query).select(select).lean().exec() as T | null;
  }

  async findByIdAndUpdate(
    id: string,
    update: UpdateQuery<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      ...options,
    });
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  async delete(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id);
  }


}
