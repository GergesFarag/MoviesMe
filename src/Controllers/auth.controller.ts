import { Request, Response } from "express";
import catchError from "../Utils/Errors/catchError";
import { firebaseAdmin } from "../Config/firebase";
import AppError, { HTTP_STATUS_CODE, HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import User from "../Models/user.model";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from "../Utils/tokenHelpers";
import { loginResponse } from "../Interfaces/response.interface";

const authController = {
  gmailLogin: catchError(async (req: Request, res: Response) => {
    //@ts-ignore
    const { uid, email } = req.user;
    let existingUser = await User.findOne({ firebaseUid: uid });
    if (!existingUser) {
      existingUser = await User.create({
        username: email?.split("@")[0] || "Anonymous",
        email: email,
        firebaseUid: uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        isAdmin: false,
      });
    }
    const responseUser: loginResponse["data"]["user"] = {
      id: String(existingUser._id),
      username: existingUser.username as string,
      isAdmin: existingUser.isAdmin,
    };
    const accessToken = createAccessToken(responseUser);
    const refreshToken = createRefreshToken(responseUser);
    res.status(200).json({
      message: "User Logged in successfully",
      data: {
        user: responseUser,
        accessToken,
        refreshToken
      },
    } as loginResponse);
  }),

  phoneLogin: catchError(async (req: Request, res: Response) => {
    //@ts-ignore
    const { uid, phone_number } = req.user;
    const existingUser = await User.findOne({ firebaseUid: uid });
    const responseUser: loginResponse["data"]["user"] = {
      id: String(existingUser?._id) ?? "",
      username: phone_number as string,
      isAdmin: false,
    };

    if (!existingUser) {
      User.create({
        username: phone_number as string,
        firebaseUid: uid,
        phoneNumber: phone_number as string,
        createdAt: new Date(),
        updatedAt: new Date(),
        isAdmin: false,
        isActive: true,
      });
    }
    const accessToken = createAccessToken(responseUser);
    const refreshToken = createRefreshToken(responseUser);
    res.status(200).json({
      message: "User loggedIn successfully",
      data: {
        user: responseUser,
        accessToken,
        refreshToken
      },
    } as loginResponse);
  }),

  login: catchError(async (req: Request, res: Response) => {
    //@ts-ignore
    const { uid, email } = req.user;
    const existingUser = await User.findOne({ firebaseUid: uid });
    if (!existingUser) {
      throw new AppError("User not found", 404);
    }
    const responseUser: loginResponse["data"]["user"] = {
      id: String(existingUser?._id) ?? "",
      username: email?.split("@")[0] || "Anonymous",
      isAdmin: existingUser?.isAdmin || false,
    };

    const accessToken = createAccessToken(responseUser);
    const refreshToken = createRefreshToken(responseUser);

    res.status(200).json({
      message: "User logged in successfully",
      data: {
        user: responseUser,
        accessToken,
        refreshToken
      },
    } as loginResponse);
  }),

  register: catchError(async (req: Request, res: Response) => {
    //@ts-ignore
    const { uid, email } = req.user;

    if (!email) {
      throw new AppError("Email is required", 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("User already exists", 409);
    }

    const newUser = await User.create({
      email,
      username: email.split("@")[0] || "Anonymous",
      firebaseUid: uid || "",
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isAdmin: false,
    });

    const responseUser: loginResponse["data"]["user"] = {
      id: String(newUser._id),
      username: newUser.email.split("@")[0] || "Anonymous",
      isAdmin: newUser.isAdmin,
    };
    const accessToken = createAccessToken(responseUser);
    const refreshToken = createRefreshToken(responseUser);

    res.status(201).json({
      message: "User registered successfully",
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
      throw new AppError("Refresh token is required",  HTTP_STATUS_CODE.UNAUTHORIZED);
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new AppError("Invalid refresh token",  HTTP_STATUS_CODE.UNAUTHORIZED);
    }

    const newAccessToken = createAccessToken(decoded);
    res.status(200).json({
      message: "Access token refreshed successfully",
      data: { accessToken: newAccessToken },
    });
  }),
};

export default authController;
