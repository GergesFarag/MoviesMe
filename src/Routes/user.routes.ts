import { Router } from "express";
import userController from "../Controllers/user.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
const userRouter = Router();

userRouter
  .route("/")
  .get(authMiddle, userController.getProfile)
  .patch(authMiddle, userController.updateProfile);
userRouter.route("/videos").get(authMiddle, userController.getUserVideos);
export default userRouter;
