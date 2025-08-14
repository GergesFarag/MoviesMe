import mongoose from "mongoose";
import { IStory } from "../Interfaces/story.interface";

const storySchema = new mongoose.Schema<IStory>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: { type: String, required: true },
  scenes: [
    {
      sceneNumber: { type: Number, required: true },
      imageDescription: { type: String, required: true },
      videoDescription: { type: String, required: true },
      image: { type: String, default: null },
      video: { type: String, default: null },
    },
  ],
});

const Story = mongoose.model<IStory>("Story", storySchema);
export default Story;
