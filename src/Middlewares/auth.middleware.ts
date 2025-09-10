import { NextFunction, Request, Response } from "express";
import { firebaseAdmin } from "../Config/firebase";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import { verifyAccessToken } from "../Utils/Auth/tokenHelpers";

export const firebaseAuth = catchError(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1]; 
    }
    if (!token) { 
      return next(new AppError("Authentication token is required", HTTP_STATUS_CODE.UNAUTHORIZED));
    }

    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      if (!decoded) {
        return next(new AppError("Invalid authentication token", HTTP_STATUS_CODE.UNAUTHORIZED));
      }
      //@ts-ignore
      req.user = decoded;
      next();
    } catch (error: any) {
      console.error("Firebase token verification error:", error);
      
      if (error.code === 'auth/id-token-expired') {
        return next(new AppError("Authentication token has expired", HTTP_STATUS_CODE.UNAUTHORIZED));
      } else if (error.code === 'auth/invalid-id-token') {
        return next(new AppError("Invalid Firebase ID token format", HTTP_STATUS_CODE.UNAUTHORIZED));
      } else if (error.message && error.message.includes('kid')) {
        return next(new AppError("Invalid Firebase ID token - missing key identifier. Please ensure you're using a valid Firebase ID token.", HTTP_STATUS_CODE.UNAUTHORIZED));
      } else {
        return next(new AppError("Authentication token verification failed", HTTP_STATUS_CODE.UNAUTHORIZED));
      }
    }
  }
);
export const authMiddle = catchError(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      next(new AppError("Authentication token is required", 401));
    }
    const decoded = verifyAccessToken(token as string);
    if (!decoded) {
      next(new AppError("Invalid authentication access token", 401));
    }
    //@ts-ignore
    req.user = decoded;
    next();
  }
);
export const isAdmin = catchError(
  async (req: Request, res: Response, next: NextFunction) => {
    //@ts-ignore
    if (!req.user || !req.user.isAdmin) {
      return next(new AppError("Unauthorized", 403));
    }
    next();
  }
);