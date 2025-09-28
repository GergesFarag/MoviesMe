import mongoose from "mongoose";
import { generationInfo } from "../Interfaces/generationInfo.interface";
const generationInfoSchema = new mongoose.Schema<generationInfo>({
  location: [
    {
      name: { type: String, required: true },
      image: { type: String, required: true },
    },
  ],
  style: [
    {
      name: { type: String, required: true },
      image: { type: String, required: true },
    },
  ],
  genres: {
    type: [String],
    required: true,
  },
  estimatedTimePerSecond: {
    type: Number,
    required: true,
    min: 15,
    max: 3600,
  },
  languages: [
    {
      name: { type: String, required: true },
      accents: [
        {
          name: { type: String, required: true },
        },
      ],
    },
  ],
  voiceOverCredits: {
    type: Number,
    required: true,
    min: 0,
  },
  generationCredits: {
    type: Number,
    required: true,
    min: 0,
  },
});

const GenerationInfo = mongoose.model<generationInfo>(
  "GenerationInfo",
  generationInfoSchema
);
export default GenerationInfo;
