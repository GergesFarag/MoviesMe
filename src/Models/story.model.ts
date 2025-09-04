import mongoose from "mongoose";
import { IStory } from "../Interfaces/story.interface";
import sceneSchema from "./scene.model";

const storySchema = new mongoose.Schema<IStory>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: { type: String, required: true },
  scenes: [sceneSchema],
});

const Story = mongoose.model<IStory>("Story", storySchema);
export default Story;
