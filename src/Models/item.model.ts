import mongoose from "mongoose";
const itemSchema = new mongoose.Schema(
  {
    URL: {
      type: String,
      required: [true, "Item URL is required"],
      trim: true,
    },
    modelType: {
      type: String,
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
    isFav: {
      type: Boolean,
      default: false,
    },
    duration: {
      type: Number,
      required: [true, "Item duration is required"],
    },
    jobId: {
      type: String,
      required: [true, "Job ID is required"],
      trim: true,
    },
    status: {
      type: String,
      required: [true, "Item status is required"],
      enum: ["pending", "completed", "failed"],
      default: "pending",
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
export default itemSchema;
