import { Router } from 'express';
import userController from '../Controllers/user.controller';
import { authMiddle, optionalAuth } from '../Middlewares/auth.middleware';
import { imageUpload, upload } from '../Config/multer';
import { cacheMiddleware } from '../Middlewares/cache.middleware';
const userRouter = Router();

userRouter
  .route('/')
  .get(authMiddle, userController.getProfile)
  .patch(
    authMiddle,
    imageUpload.single('profilePicture'),
    userController.updateProfile
  )
  .delete(authMiddle, userController.deleteUser);

userRouter
  .route('/effect/fav')
  .post(authMiddle, userController.toggleEffectFav);

userRouter.route('/story/fav').post(authMiddle, userController.toggleStoryFav);

userRouter
  .route('/generation/fav')
  .post(authMiddle, userController.toggleGenerationFav);

userRouter
  .route('/notifications')
  .get(authMiddle, userController.getNotifications);

userRouter
  .route('/lib/effects')
  .get(authMiddle, userController.getUserEffectsLib)
  .delete(authMiddle, userController.deleteBulkEffects);

userRouter
  .route('/lib/effects/:itemId')
  .delete(authMiddle, userController.deleteItem);

userRouter
  .route('/lib/stories')
  .get(authMiddle, userController.getUserStoriesLib)
  .delete(authMiddle, userController.deleteBulkStories);

userRouter
  .route('/lib/stories/:storyId')
  .get(optionalAuth, userController.getUserStory)
  .delete(authMiddle, userController.deleteUserStory);

userRouter
  .route('/lib/generations')
  .get(authMiddle, userController.getUserGenerationsLib)
  .delete(authMiddle, userController.deleteBulkGenerations);

userRouter
  .route('/lib/generations/:id')
  .get(authMiddle, userController.getGenerationById)
  .delete(authMiddle, userController.deleteGeneration);

export default userRouter;
