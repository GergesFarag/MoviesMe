import { Request, Response } from "express";
import app from "../src/app";
import connectDB from "../src/Config/db";


let isConnected = false;

export default async function handler(req: Request, res: Response) {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }
    return app(req, res);
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ status: 'error', message: 'Init failed' });
  }
}
