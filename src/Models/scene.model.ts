import mongoose from "mongoose";
import { IScene } from "../Interfaces/scene.interface";

const sceneSchema = new mongoose.Schema<IScene>(
  {
    sceneNumber: Number,
    imageDescription: {
      type: String,
      required: [true, "Image description is required"],
    },
    videoDescription: {
      type: String,
      required: [true, "Video description is required"],
    },
    narration: {
      type: String,
      required: false,
    },
    sceneDescription: {
      type: String,
      required: [true, "Scene description is required"],
    },
    image: { type: String, required: true },
  },
  {
    timestamps: true,
    _id: true,
  }
);
export default sceneSchema;
