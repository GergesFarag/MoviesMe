import mongoose from "mongoose";
import IAiModel from "../Interfaces/aiModel.interface";

const modelSchema = new mongoose.Schema<IAiModel>({
    name: { type: String, required: true },
    thumbnail: { type: String, required: true },
    previewUrl: { type: String, required: true },
    isVideo: { type: Boolean, required: true },
    credits: { type: Number, required: true },
    isNewModel: { type: Boolean, required: true , default: true },
    isVideoEffect: { type: Boolean, default: false , select: false },
    isImageEffect: { type: Boolean, default: false , select: false },
    isTrending: { type: Boolean, required: true , default: false },
    isCharacterEffect: { type: Boolean, default: false ,select: false },
    isAITool: { type: Boolean, default: false , select: false },
    isAI3DTool: { type: Boolean, default: false , select: false },
    isMarketingTool: { type: Boolean, default: false , select: false },
})

const Model = mongoose.model<IAiModel>("Model", modelSchema);

export default Model;