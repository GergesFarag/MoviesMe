import mongoose, { Schema } from "mongoose";
import { IJob } from "../Interfaces/job.interface";

const jobSchema = new Schema<IJob>({
    jobId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    modelId: { type: Schema.Types.ObjectId, ref: "Model", required: true },
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})
const Job = mongoose.model<IJob>("Job", jobSchema);
export default Job;
