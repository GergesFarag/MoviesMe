import { Router } from 'express';
import generationLibController from '../Controllers/generationLib.controller';
import { authMiddle } from '../Middlewares/auth.middleware';
import { imageUpload } from '../Config/multer';
import { cacheMiddleware } from '../Middlewares/cache.middleware';
import { expensiveOperationLimiter } from '../Middlewares/rateLimiter.middleware';

const router = Router();

router.post(
  '/',
  authMiddle,
  expensiveOperationLimiter,
  imageUpload.any(),
  generationLibController.createGeneration
);
router.get('/', cacheMiddleware, generationLibController.getGenerationInfo);
router.patch('/', authMiddle, generationLibController.updateGenerationInfo);
router.post(
  '/retry/:jobId',
  authMiddle,
  generationLibController.retryGenerationLibJob
);
export default router;
