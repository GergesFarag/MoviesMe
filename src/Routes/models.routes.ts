import { Router } from 'express';
import modelsController from '../Controllers/models.controller';
import { authMiddle } from '../Middlewares/auth.middleware';
import { upload } from '../Config/multer';
import { updateUserLanguagePreference } from '../Middlewares/language.middleware';
import { cacheMiddleware } from '../Middlewares/cache.middleware';
import { expensiveOperationLimiter } from '../Middlewares/rateLimiter.middleware';

const modelsRouter = Router();
modelsRouter.get(
  '/videoEffects',
  cacheMiddleware,
  modelsController.getVideoModels
);
modelsRouter.get(
  '/imageEffects',
  cacheMiddleware,
  modelsController.getImageModels
);
modelsRouter.get(
  '/characterEffects',
  cacheMiddleware,
  modelsController.getCharacterEffects
);
modelsRouter.get('/aiTools', cacheMiddleware, modelsController.getAITools);
modelsRouter.get('/ai3dTools', cacheMiddleware, modelsController.getAI3DTools);
modelsRouter.get(
  '/marketingTools',
  cacheMiddleware,
  modelsController.getMarketingTools
);
modelsRouter.get(
  '/trending',
  cacheMiddleware,
  modelsController.getTrendingModels
);
modelsRouter.get(
  '/categories',
  cacheMiddleware,
  modelsController.getModelsCategories
);
modelsRouter.post('/', modelsController.addModel);
modelsRouter.post(
  '/applyModel',
  authMiddle,
  expensiveOperationLimiter,
  upload.array('payload[image]'),
  updateUserLanguagePreference,
  modelsController.applyModel
);
modelsRouter.post(
  '/retry/:jobId',
  authMiddle,
  expensiveOperationLimiter,
  modelsController.retryEffectJob
);
modelsRouter
  .route('/:id')
  .patch(modelsController.updateModel)
  .delete(modelsController.deleteModel);
export default modelsRouter;
