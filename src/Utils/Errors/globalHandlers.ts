import { Response } from "express";
import AppError, { HTTP_STATUS_CODE } from "./AppError";

export const handleCastErrorDB = (err: any): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, HTTP_STATUS_CODE.BAD_REQUEST);
};
export const handleDuplicateFieldsDB = (err: any): AppError => {
  const value = err.keyValue.name || err.keyValue.email;
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, HTTP_STATUS_CODE.CONFLICT);
};
export const handleValidationErrorDB = (err: any): AppError => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data: ${errors.join(". ")}`;
  return new AppError(message, HTTP_STATUS_CODE.BAD_REQUEST);
};
export const handleNotFoundError = (err: any): AppError => {
  return new AppError("Not Found Route", HTTP_STATUS_CODE.NOT_FOUND);
};
export const handleUnAuthorizedAccess = (err: any): AppError => {
  return new AppError("Unauthorized Access", HTTP_STATUS_CODE.UNAUTHORIZED);
};
export const handleUnknownError = (err: any, res: Response) => {
  return new AppError(err.message, err.statusCode);
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
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
};
