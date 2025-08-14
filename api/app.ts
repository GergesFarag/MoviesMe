import { Request, Response } from "express";
import app from "../src/app";
import connectDB from "../src/Config/db";

// Prevent reconnecting on every request
let isConnected = false;

export default async function handler(req: Request, res: Response) {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }
    // Pass the request to Express
    return (app as any)(req, res);
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ status: 'error', message: 'Init failed' });
  }
}
