import mongoose from "mongoose";
import { IScene } from "../Interfaces/scene.interface";

const sceneSchema = new mongoose.Schema<IScene>(
  {
    sceneNumber: Number,
    imageDescription: String,
    videoDescription: String,
    sceneDescription: String,
    image: { type: String, required: false },
    video: { type: String, required: false },
  },
  {
    timestamps: true,
    _id: true,
  }
);
export default sceneSchema;
