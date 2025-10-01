import { ObjectId } from "mongoose";
export type jobStatus = "pending" | "completed" | "failed";
export interface IJob {
  jobId: string;
  userId: ObjectId;
  status: jobStatus;
  createdAt: Date;
  updatedAt: Date;
  modelId?: ObjectId;
}
