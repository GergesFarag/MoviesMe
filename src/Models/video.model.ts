import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    URL: {
      type: String,
      required: [true, "Video URL is required"],
      trim: true,
    },
    modelType: {
      type: String,
      required: [true, "Model type is required"],
      trim: true,
    },
    modelName: {
      type: String,
      required: [true, "Model name is required"],
      trim: true,
    },
    isVideo: {
      type: Boolean,
      required: [true, "isVideo flag is required"],
      default: true,
    },
    modelThumbnail: {
      type: String,
      required: [true, "Model thumbnail is required"],
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      select: false,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      select: false,
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);
export default videoSchema;
