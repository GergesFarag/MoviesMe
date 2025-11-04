import mongoose from 'mongoose';
import IAiModel from '../Interfaces/aiModel.interface';
import { CATEGORIES } from '../Constants/modelConstants';

const modelSchema = new mongoose.Schema<IAiModel>({
  name: { type: String, required: true },
  thumbnail: { type: String, required: true },
  previewUrl: { type: String, required: true },
  isVideo: { type: Boolean, required: true },
  credits: { type: Number, required: true },
  wavespeedCall: { type: String, default: null, required: true, select: true },
  category: {
    type: String,
    enum: {
      values: CATEGORIES,
      message:
        '{VALUE} is not a valid category Please select from: ' +
        CATEGORIES.join(', '),
    },
    required: true,
  },
  prompt: { type: String, required: false, default: null },
  minImages: { type: Number, required: false, min: 1 },
  maxImages: { type: Number, required: false, max: 10 },
  isNewModel: { type: Boolean, required: true, default: true },
  isVideoEffect: { type: Boolean, default: false, select: false },
  isImageEffect: { type: Boolean, default: false, select: false },
  isTrending: { type: Boolean, required: true, default: false },
  isCharacterEffect: { type: Boolean, default: false, select: false },
  isAITool: { type: Boolean, default: false, select: false },
  isAI3DTool: { type: Boolean, default: false, select: false },
  isMarketingTool: { type: Boolean, default: false, select: false },
});

const Model = mongoose.model<IAiModel>('Model', modelSchema);
export default Model;
