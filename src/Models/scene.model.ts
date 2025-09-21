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
    sceneDescription: {
      type: String,
      required: [true, "Scene description is required"],
    },
    image: { type: String, required: true },
    narration: {
      type: String,
      required: false,
    },
    scenePrompt: { type: String, required: false },
  },
  {
    timestamps: true,
    _id: true,
  }
);
export default sceneSchema;
