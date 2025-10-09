import mongoose, { Schema } from "mongoose";
import { IGenerationInfo } from "../Interfaces/generationInfo.interface";
import {
  IGenerationImageLibModel,
  IGenerationVideoLibModel,
} from "../Interfaces/aiModel.interface";

const baseGenerationSchema = {
  name: { type: String, required: true },
  thumbnail: { type: String, required: true },
  wavespeedCall: { type: String, required: true },
};

const generationImageModelSchema: Schema = new Schema<IGenerationImageLibModel>(
  {
    ...baseGenerationSchema,
    credits: { type: Number, required: true },
    isVideo: { type: Boolean, default: false, required: true },
    minImages: { type: Number, required: true },
    maxImages: { type: Number, required: true },
    requirePrompt: { type: Boolean, default: false },
  }
);

const generationVideoModelSchema: Schema = new Schema<IGenerationVideoLibModel>(
  {
    ...baseGenerationSchema,
    credits: {
      type: [
        {
          type: Map,
          of: Number,
        },
      ],
      required: true,
    },
    isVideo: { type: Boolean, default: true, required: true },
    minImages: { type: Number, required: true },
    maxImages: { type: Number, required: true },
    requirePrompt: { type: Boolean, default: false },
  }
);

const generationInfoSchema = new Schema<IGenerationInfo>(
  {
    imageModels: { type: [generationImageModelSchema], default: [] },
    videoModels: { type: [generationVideoModelSchema], default: [] },
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
