import { Router } from "express";
import userController from "../Controllers/user.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
const userRouter = Router();

userRouter
  .route("/")
  .get(authMiddle, userController.getProfile)
  .patch(authMiddle, userController.updateProfile);
userRouter.route("/lib").get(authMiddle, userController.getUserLibrary);
userRouter
  .route("/fav")
  .get(authMiddle, userController.getUserFavorites)
  .post(authMiddle, userController.toggleFav);

export default userRouter;
