import { Request, Response } from "express";
import catchError from "../Utils/Errors/catchError";
import { firebaseAdmin } from "../Config/firebase";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import User from "../Models/user.model";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from "../Utils/Auth/tokenHelpers";
import { loginResponse } from "../Interfaces/response.interface";
import { translationService } from "../Services/translation.service";
const authController = {
  login: catchError(async (req: Request, res: Response) => {
    const { uid, email, phone_number } = req.user!;
    let existingUser = await User.findOne({ firebaseUid: uid });
    if (!existingUser) {
      existingUser = await User.create({
        username: email?.split("@")[0] || phone_number || null,
        email: email || null,
        phoneNumber: phone_number || null,
        firebaseUid: uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        isAdmin: false,
        credits: 10,
      });
    }
    const responseUser: loginResponse["data"]["user"] = {
      id: String(existingUser._id),
      username: existingUser.username as string,
      credits: existingUser.credits || 10,
      isAdmin: existingUser.isAdmin,
    };
    const accessToken = createAccessToken(responseUser);
    const refreshToken = createRefreshToken(responseUser);
    res.status(200).json({
      message: "User Logged in successfully",
      greeting: translationService.translateText(
        "user",
        "greeting",
        req.headers["accept-language"] || "en",
        { name: responseUser.username }
      ),
      data: {
        user: responseUser,
        accessToken,
        refreshToken,
      },
    } as loginResponse);
  }),

  register: catchError(async (req: Request, res: Response) => {
    const { uid, email } = req.user!;

    if (!email) {
      throw new AppError("Email is required", 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("User already exists", 409);
    }

    let newUser;
    try {
      newUser = await User.create({
        email,
        username: email.split("@")[0] || null,
        firebaseUid: uid || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        isAdmin: false,
        credits: 10,
      });
    } catch (error) {
      throw new AppError("Failed to create user", 500);
    }

    const responseUser: loginResponse["data"]["user"] = {
      id: String(newUser._id),
      username: newUser.username as string,
      credits: newUser.credits || 10,
      isAdmin: newUser.isAdmin,
    };
    const accessToken = createAccessToken(responseUser);
    const refreshToken = createRefreshToken(responseUser);

    res.status(201).json({
      message: "User registered successfully",
       greeting: translationService.translateText(
        "user",
        "greeting",
        req.headers["accept-language"] || "en",
        { name: responseUser.username }
      ),
      data: {
        user: responseUser,
        accessToken,
        refreshToken,
      },
    } as loginResponse);
  }),

  forgotPassword: catchError(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new AppError("Email is required", 400);
    }
    const resetLink = await firebaseAdmin
      .auth()
      .generatePasswordResetLink(email);

    if (!resetLink) {
      throw new AppError("Failed to generate reset link", 500);
    }
    res.status(200).json({
      message: "Password reset link sent to your email",
      data: { resetLink },
    });
  }),

  refreshToken: catchError(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(
        "Refresh token is required",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new AppError(
        "Invalid refresh token",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }

    const newAccessToken = createAccessToken(decoded);
    res.status(200).json({
      message: "Access token refreshed successfully",
      data: { accessToken: newAccessToken },
    });
  }),

  addFcmToken: catchError(async (req: Request, res: Response) => {
    const { FCMToken } = req.body;

    if (!FCMToken) {
      throw new AppError(
        "FCM token is required",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }
    const user = await User.findById(req.user!.id).select("+FCMToken");
    if (!user) {
      throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    user.FCMToken = FCMToken;
    await user.save();
    res.status(200).json({
      message: "FCM token added successfully",
      data: { fcmToken: user.FCMToken },
    });
  }),
};

export default authController;
