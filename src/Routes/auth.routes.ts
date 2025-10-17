import { Router } from "express";
import authController from "../Controllers/auth.controller";
import { authMiddle, firebaseAuth } from "../Middlewares/auth.middleware";
import { requestOtp , verifyOtp } from "../Controllers/otp.controller";
const authRouter = Router();
authRouter.post("/gmailLogin", firebaseAuth , authController.login);
authRouter.post("/phoneLogin" , firebaseAuth , authController.login);
authRouter.post("/login" , firebaseAuth , authController.login);
authRouter.post("/register", firebaseAuth , authController.register);
authRouter.post("/forgotPassword", authController.forgotPassword);
authRouter.post("/refreshToken", authController.refreshToken);
authRouter.post("/fcmToken", authMiddle, authController.addFcmToken);
authRouter.post("/requestOtp", requestOtp);
authRouter.post("/verifyOtp", verifyOtp);

export default authRouter;
 