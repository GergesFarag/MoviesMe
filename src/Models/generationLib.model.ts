import { Schema, Types } from "mongoose";
import { IGenerationLib } from "../Interfaces/generationLib.interface";

const generationLibSchema = new Schema<IGenerationLib>({
  _id: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
  URL: { type: String, required: false },
  isVideo: { type: Boolean, default: false },
  jobId: { type: Schema.Types.Mixed, required: true },
  thumbnail: { type: String, required: false },
  status: { type: String, required: true, default: "pending" },
  data: {
    type: {
      prompt: { type: String, required: false },
      modelId: { type: String, required: true },
      refImages: { type: [String], required: false },
      isVideo: { type: Boolean, required: false, default: false }
    },
    required: true,
  },
  credits: { type: Number, required: true },
  isFav: { type: Boolean, default: false },
  duration: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default generationLibSchema;
