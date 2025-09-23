import mongoose, { mongo, Schema } from "mongoose";
import { IAudioModel } from "../Interfaces/audioModel.interface";

const audioModelSchema = new Schema<IAudioModel>(
  {
    name: { type: String, required: true },
    language: { type: String, required: true },
    elevenLabsId: { type: String, required: true, unique: true },
    thumbnail: { type: String, required: false },
    gender: { type: String, enum: ["male", "female", "kid"], required: true },
  },
  { timestamps: true, _id: true }
);
const AudioModel = mongoose.model<IAudioModel>("AudioModel", audioModelSchema);
export default AudioModel;
