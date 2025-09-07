import { Router } from "express";
import userController from "../Controllers/user.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
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
userRouter.route("/lib/effects").get(authMiddle, userController.getUserLibrary);
userRouter
  .route("/lib/stories")
  .get(authMiddle, userController.getUserStoriesLibrary);
userRouter
  .route("/lib/stories/:storyId")
  .get(userController.getUserStory)
  .delete(userController.deleteUserStory);
userRouter.route("/fav").post(authMiddle, userController.toggleFav);
userRouter
  .route("/notifications")
  .get(authMiddle, userController.getNotifications);
userRouter.route("/lib/:itemId").delete(authMiddle, userController.deleteItem);
export default userRouter;
