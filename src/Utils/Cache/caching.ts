import NodeCache from 'node-cache';
import Model from '../../Models/ai.model';
import IAiModel from '../../Interfaces/aiModel.interface';
import { IUser } from '../../Interfaces/user.interface';
import { UserWithId } from '../../types/modelProcessing.types';
import { aiModelKeys } from '../../Constants/modelConstants';

const modelCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
export const getCachedModel = async (
  modelId: string
): Promise<IAiModel | null> => {
  const cacheKey = `model_${modelId}`;

  let model = modelCache.get<IAiModel>(cacheKey);

  if (!model) {
    model = (await Model.findById(modelId)
      .select(aiModelKeys)
      .lean()) as IAiModel;

    if (model) {
      modelCache.set(cacheKey, model);
    }
  }

  return model || null;
};

const userCache = new NodeCache({ stdTTL: 180, checkperiod: 60 });

export const getCachedUser = async (
  userId: string,
  userModel: any
): Promise<IUser | null> => {
  const cacheKey = `user_${userId}`;

  let user = userCache.get<UserWithId>(cacheKey);

  if (!user) {
    user = (await userModel
      .findById(userId)
      .select('+FCMToken +_id')
      .lean()) as UserWithId;

    if (user) {
      userCache.set(cacheKey, user);
    }
  }

  return user || null;
};

export const clearCache = (cache: NodeCache, key?: string) => {
  if (key) {
    cache.del(key);
    console.log(`Cache cleared for key: ${key}`);
  } else {
    cache.flushAll();
    console.log('All cache cleared');
  }
};
