import { NextFunction, Request, Response } from "express";
import { firebaseAdmin } from "../Config/firebase";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import { verifyAccessToken } from "../Utils/tokenHelpers";

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
      next(new AppError("Authentication token is required", 401));
    }
    const decoded = await firebaseAdmin.auth().verifyIdToken(token || "");
    if (!decoded) {
      next(new AppError("Invalid authentication token", 401));
    }
    //@ts-ignore
    req.user = decoded;
    next();
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
    console.log(`Token:${token}`);
    const decoded = verifyAccessToken(token as string);
    if (!decoded) {
      next(new AppError("Invalid authentication access token", 401));
    }
    //@ts-ignore
    req.user = decoded;
    next();
  }
);
