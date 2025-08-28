import { Router } from "express";
import userController from "../Controllers/user.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
import { imageUpload, upload } from "../Config/multer";
const userRouter = Router();

userRouter
  .route("/")
  .get(authMiddle, userController.getProfile)
  .patch(authMiddle, imageUpload.single("profilePicture"), userController.updateProfile);
userRouter.route("/lib").get(authMiddle, userController.getUserLibrary);
userRouter.route("/fav").post(authMiddle, userController.toggleFav);
userRouter.route("/lib/:itemId").delete(authMiddle, userController.deleteItem);
export default userRouter;
