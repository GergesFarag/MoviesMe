import { ObjectId } from "mongoose";

export interface ICreditService {
  addCredits(userId: ObjectId, credits: number): Promise<boolean>;
  deductCredits(userId: ObjectId, credits: number): Promise<boolean>;
  getCredits(userId: ObjectId): Promise<number>;
  hasSufficientCredits(userId: ObjectId, credits: number): Promise<boolean>;
}
