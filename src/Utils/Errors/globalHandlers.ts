import { NextFunction, Request, Response } from "express";
import AppError, { HTTP_STATUS_CODE } from "./AppError";

const handleCastErrorDB = (err: any): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, HTTP_STATUS_CODE.BAD_REQUEST);
};
const handleDuplicateFieldsDB = (err: any): AppError => {
  const value = err.keyValue.name || err.keyValue.email;
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, HTTP_STATUS_CODE.CONFLICT);
};
const handleValidationErrorDB = (err: any): AppError => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data: ${errors.join(". ")}`;
  return new AppError(message, HTTP_STATUS_CODE.BAD_REQUEST);
};
const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};
const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error("ERROR 💥", err);
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Something went wrong!",
    });
  }
};
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("ERROR HANDLER CALLED");
  err.statusCode = err.statusCode || HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
  err.status = err.status || "error";
  if (process.env.NODE_ENV === "development") {
    console.log("DEV ERROR 💥", err);
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.statusCode === HTTP_STATUS_CODE.DB_DUPLICATE)
      error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);
    sendErrorProd(error, res);
  }
};
