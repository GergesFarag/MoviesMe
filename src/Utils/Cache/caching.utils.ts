import NodeCache from 'node-cache';
import Model from '../../Models/ai.model';
import IAiModel from '../../Interfaces/aiModel.interface';
import { IUser } from '../../Interfaces/user.interface';
import { UserWithId } from '../../types/modelProcessing.types';
import { aiModelKeys } from '../../Constants/modelConstants';
import appCache from './appCache';
import { Request } from 'express';
import { extractLanguageFromRequest } from '../Format/languageUtils';

export const getCachedModel = async (
  modelId: string
): Promise<IAiModel | null> => {
  const cacheKey = `model_${modelId}`;

  let model = appCache.get(cacheKey);

  if (!model) {
    model = (await Model.findById(modelId)
      .select(aiModelKeys)
      .lean()) as IAiModel;

    if (model) {
      appCache.set(cacheKey, model);
    }
  }
  return model || null;
};

export const getCachedUser = async (
  userId: string,
  userModel: any
): Promise<IUser | null> => {
  const cacheKey = `user_${userId}`;

  let user = appCache.get(cacheKey);

  if (!user) {
    user = (await userModel
      .findById(userId)
      .select('+FCMToken +_id')
      .lean()) as UserWithId;

    if (user) {
      appCache.set(cacheKey, user);
    }
  }

  return user || null;
};

export const getCacheKey = (
  userId: string,
  reqMethod: string,
  reqUrl: string,
  req: Request
) => {
  return `${userId}:${reqMethod}:${reqUrl}:${extractLanguageFromRequest(req)}`;
};
