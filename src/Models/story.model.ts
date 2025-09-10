import mongoose from "mongoose";
import { IStory } from "../Interfaces/story.interface";
import sceneSchema from "./scene.model";
import { IVoiceOver } from "../Interfaces/storyRequest.interface";
const storySchema = new mongoose.Schema<IStory>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    scenes: [sceneSchema],
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      required: true,
    },
    videoUrl: { type: String, required: false, default: "" },
    duration: { type: Number, required: [true, "Duration is required"] },
    isFav: { type: Boolean, default: false },
    genre: { type: String },
    jobId: { type: String, required: true, unique: true },
    location: { type: String },
    prompt: { type: String, required: true },
    style: { type: String, required: false, default: "" },
    thumbnail: { type: String, required: false, default: "" },
    voiceOver: {
      type: {
        voiceOverLyrics: {
          type: String,
          null: true,
        },
        voiceLanguage: {
          type: String,
          null: true,
        },
        voiceGender: {
          type: String,
          enum: ["male", "female", "kid"],
        },
        sound: { type: String, null: true },
        text: { type: String, null: true },
      },
      required: false,
    },
  },
  {
    timestamps: true, // This automatically adds createdAt and updatedAt fields
  }
);

const Story = mongoose.model<IStory>("Story", storySchema);
export default Story;
