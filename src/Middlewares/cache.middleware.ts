import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS_CODE } from '../Enums/error.enum';
import appCache from '../Utils/Cache/appCache';
import { getCurrentUserLanguage } from './language.middleware';
import { extractLanguageFromRequest } from '../Utils/Format/languageUtils';

export const cacheMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = req.user ? req.user.id : null;
  const cacheKey = `${userId}:${req.method}:${
    req.originalUrl
  }:${extractLanguageFromRequest(req)}`;

  const cachedData = appCache.get(cacheKey);
  if (cachedData) {
    console.log('cache hit');
    return res.status(HTTP_STATUS_CODE.OK).json(cachedData);
  }
  console.log('cache miss');
  res.sendResponse = res.json;
  res.json = (body) => {
    appCache.set(cacheKey, body);
    return res.sendResponse(body);
  };
  next();
};
