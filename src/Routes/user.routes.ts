import { Router } from "express";
import userController from "../Controllers/user.controller";
import { authMiddle, optionalAuth } from "../Middlewares/auth.middleware";
import { imageUpload, upload } from "../Config/multer";
const userRouter = Router();

userRouter
  .route("/")
  .get(authMiddle, userController.getProfile)
  .patch(
    authMiddle,
    imageUpload.single("profilePicture"),
    userController.updateProfile
  );
userRouter
  .route("/effect/fav")
  .post(authMiddle, userController.toggleEffectFav);
userRouter.route("/story/fav").post(authMiddle, userController.toggleStoryFav);

userRouter
  .route("/notifications")
  .get(authMiddle, userController.getNotifications);

userRouter.route("/lib/effects").get(authMiddle, userController.getUserLibrary);
userRouter
  .route("/lib/effects/:itemId")
  .delete(authMiddle, userController.deleteItem);

userRouter
  .route("/lib/stories")
  .get(authMiddle, userController.getUserStoriesLibrary);

userRouter
  .route("/lib/stories/:storyId")
  .get(optionalAuth, userController.getUserStory)
  .delete(authMiddle, userController.deleteUserStory);

userRouter
  .route("/lib/generations")
  .get(authMiddle, userController.getUserGenerations);

userRouter
  .route("/lib/generations/:id")
  .get(authMiddle, userController.getGenerationById)
  .patch(authMiddle, userController.updateGenerationFavoriteStatus)
  .delete(authMiddle, userController.deleteGeneration);

export default userRouter;
