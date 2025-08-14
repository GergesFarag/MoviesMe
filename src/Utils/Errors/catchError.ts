import { NextFunction, Request, Response } from "express";

const catchError = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await fn(req, res, next).catch(next);
  };
};
export default catchError;