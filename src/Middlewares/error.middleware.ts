import { Request, Response, NextFunction } from "express";
import AppError from "../Utils/Errors/AppError";
import { DB_ERROR_CODE } from "../Enums/error.enum";
import {
  handleCastErrorDB,
  handleDuplicateFieldsDB,
  handleValidationErrorDB,
  handleJWTError,
  handleJWTExpiredError,
  handleUnknownError,
  sendErrorDev,
  sendErrorProd,
} from "../Utils/Errors/globalHandlers";

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  if (err.name === "CastError") {
    error = handleCastErrorDB(error);
  }

  if (err.code === DB_ERROR_CODE.DUPLICATE_KEY) {
    error = handleDuplicateFieldsDB(error);
  }

  if (err.name === "ValidationError") {
    error = handleValidationErrorDB(error);
  }

  if (err.name === "JsonWebTokenError") {
    error = handleJWTError();
  }

  if (err.name === "TokenExpiredError") {
    error = handleJWTExpiredError();
  }

  if (!(error instanceof AppError)) {
    error = handleUnknownError(error);
  }

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

export default globalErrorHandler;
