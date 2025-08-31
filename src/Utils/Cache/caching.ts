import NodeCache from 'node-cache';
import Model from '../../Models/aiModel.model';
import IAiModel from '../../Interfaces/aiModel.interface';
import { IUser } from '../../Interfaces/user.interface';

// Cache for 15 minutes
const modelCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

export const getCachedModel = async (modelId: string): Promise<IAiModel | null> => {
  const cacheKey = `model_${modelId}`;
  
  // Try to get from cache first
  let model = modelCache.get<IAiModel>(cacheKey);
  
  if (!model) {
    // If not in cache, fetch from database with all necessary fields for filtering
    model = await Model.findById(modelId)
      .select("name isVideo thumbnail isVideoEffect isImageEffect isCharacterEffect isAITool isAI3DTool isMarketingTool")
      .lean() as IAiModel;
    
    if (model) {
      modelCache.set(cacheKey, model);
    }
  }
  
  return model || null;
};

// Cache for user data (shorter TTL)
const userCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const getCachedUser = async (userId: string, userModel: any): Promise<IUser | null> => {
  const cacheKey = `user_${userId}`;
  
  let user = userCache.get<IUser>(cacheKey);
  
  if (!user) {
    user = await userModel.findById(userId).select("+FCMToken").lean() as IUser;
    
    if (user) {
      userCache.set(cacheKey, user);
    }
  }
  
  return user || null;
};
