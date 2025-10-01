import mongoose from "mongoose";
import { IStoryGenerationInfo } from "../Interfaces/storyGenerationInfo.interface";
const storyGenerationInfoSchema = new mongoose.Schema<IStoryGenerationInfo>({
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

const StoryGenerationInfo = mongoose.model<IStoryGenerationInfo>(
  "storyGenerationInfo",
  storyGenerationInfoSchema
);
export default StoryGenerationInfo;
