import { NextFunction, Request, Response } from "express";
import {
  handleCastErrorDB,
  handleDuplicateFieldsDB,
  handleNotFoundError,
  handleUnAuthorizedAccess,
  handleUnknownError,
  handleValidationErrorDB,
  sendErrorDev,
  sendErrorProd,
} from "../Utils/Errors/globalHandlers";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";

const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
  err.status = err.status || "error";
  if (process.env.NODE_ENV === "development") {
    console.log("DEV ERROR 💥", err);
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    console.log(error);
    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.statusCode === HTTP_STATUS_CODE.DB_DUPLICATE)
      error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);
    if (error.statusCode === HTTP_STATUS_CODE.NOT_FOUND)
      error = handleNotFoundError(error);
    if (error.statusCode === HTTP_STATUS_CODE.UNAUTHORIZED)
      error = handleUnAuthorizedAccess(error);
    else error = handleUnknownError(error, res);
    sendErrorProd(error, res);
  }
};
export default errorHandler;
