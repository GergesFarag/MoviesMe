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
    refImage: { type: String, required: false, default: null },
    videoUrl: { type: String, required: false, default: null },
    duration: { type: Number, required: [true, "Duration is required"] },
    isFav: { type: Boolean, default: false },
    genre: { type: String, default: null },
    jobId: { type: String, required: true, unique: true },
    location: { type: String, default: null },
    prompt: { type: String, required: true },
    style: { type: String, required: false, default: null },
    thumbnail: { type: String, required: false, default: null },
    voiceOver: {
      type: {
        voiceOverLyrics: {
          type: String,
          default: null,
        },
        voiceLanguage: {
          type: String,
          default: null,
        },
        voiceAccent: {
          type: String,
          default: null,
        },
        voiceGender: {
          type: String,
          default: null,
        },
        sound: { type: String, default: null },
        text: { type: String, default: null },
      },
      required: false,
      default: null,
    },
    credits: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  }
);

const Story = mongoose.model<IStory>("Story", storySchema);
export default Story;
