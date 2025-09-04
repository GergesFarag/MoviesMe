import mongoose from "mongoose";
import {
  generatinInfo,
} from "../Interfaces/generationInfo.interface";

const locationSchema = new mongoose.Schema<generatinInfo["location"]>({
  name: { type: String, required: true },
  image: { type: String, required: true },
});
const styleSchema = new mongoose.Schema<generatinInfo["style"]>({
  name: { type: String, required: true },
  image: { type: String, required: true },
});
const generationInfoSchema = new mongoose.Schema<generatinInfo>({
  location: [locationSchema],
  style: [styleSchema],
  genres: {
    type: [String],
    required: true,
  },
  estimatedTimePerSecond: {
    type: Number,
    required: true,
    min: 15,
    max:3600
  },
  languages: {
    type: [{ 
      lang: String 
    }],
    required: true,
  },
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

const GenerationInfo = mongoose.model<generatinInfo>(
  "GenerationInfo",
  generationInfoSchema
);
export default GenerationInfo;
