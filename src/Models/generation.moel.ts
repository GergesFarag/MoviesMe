import mongoose, { Schema } from "mongoose";
import { IGenerationInfo } from "../Interfaces/generationInfo.interface";

const generationInfoSchema = new Schema<IGenerationInfo>(
  {
    creditsPerImage: { type: Number, min: 5 },
    creditsPerVideo: { type: Number, min: 10 },
    defaultVideoDuration: { type: Number, default: 5 },
    maxVideoDuration: { type: Number, min: 5, max: 10 },
  },
  {
    timestamps: true,
  }
);
const GenerationInfo = mongoose.model<IGenerationInfo>(
  "GenerationInfo",
  generationInfoSchema
);
export default GenerationInfo;