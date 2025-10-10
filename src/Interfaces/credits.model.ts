import { ObjectId } from "mongoose";

export interface ICreditService {
  addCredits(userId: string, credits: number): Promise<boolean>;
  deductCredits(userId: string, credits: number): Promise<boolean>;
  getCredits(userId: string): Promise<number>;
  hasSufficientCredits(userId: string, credits: number): Promise<boolean>;
}
