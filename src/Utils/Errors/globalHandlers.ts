import { Response } from "express";
import AppError, { HTTP_STATUS_CODE, DB_ERROR_CODE } from "./AppError";

export const handleCastErrorDB = (err: any): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, HTTP_STATUS_CODE.BAD_REQUEST);
};

export const handleDuplicateFieldsDB = (err: any): AppError => {
  const value =
    err.keyValue?.name ||
    err.keyValue?.email ||
    Object.values(err.keyValue || {})[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, HTTP_STATUS_CODE.CONFLICT);
};

export const handleValidationErrorDB = (err: any): AppError => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data: ${errors.join(". ")}`;
  return new AppError(message, HTTP_STATUS_CODE.BAD_REQUEST);
};

export const handleNotFoundError = (): AppError => {
  return new AppError("Route not found", HTTP_STATUS_CODE.NOT_FOUND);
};

export const handleUnAuthorizedAccess = (): AppError => {
  return new AppError("Unauthorized access", HTTP_STATUS_CODE.UNAUTHORIZED);
};

export const handleJWTError = (): AppError => {
  return new AppError(
    "Invalid token. Please log in again!",
    HTTP_STATUS_CODE.UNAUTHORIZED
  );
};

export const handleJWTExpiredError = (): AppError => {
  return new AppError(
    "Your token has expired! Please log in again.",
    HTTP_STATUS_CODE.UNAUTHORIZED
  );
};

export const handleUnknownError = (err: any): AppError => {
  if (err instanceof AppError) {
    return err;
  }
  const message = err.message || "Something went wrong!";
  const statusCode = err.statusCode || HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;

  return new AppError(message, statusCode);
};

export const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

export const sendErrorProd = (err: AppError, res: Response) => {
  // Only send operational errors to client in production
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or unknown errors: don't leak error details
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Something went wrong!",
    });
  }
};
