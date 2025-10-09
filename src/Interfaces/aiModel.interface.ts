import { Document } from "mongoose";

export type TModelCategory =
  | "fashion"
  | "fantasy"
  | "gaming"
  | "romance"
  | "sports"
  | "cinematic"
  | "ai tools"
  | "artistic"
  | "character"
  | "lifestyle"
  | "unknown";
interface IGeneralModel extends Document {
  name: string;
  thumbnail: string;
  isVideo: boolean;
  wavespeedCall: string;
  category: TModelCategory;
}
export default interface IAiModel extends IGeneralModel {
  previewUrl: string;
  isNewModel: boolean;
  isTrending: boolean;
  minImages: number;
  maxImages: number;
  credits: number;
  isVideoEffect?: boolean;
  isImageEffect?: boolean;
  isCharacterEffect?: boolean;
  isAITool?: boolean;
  isAI3DTool?: boolean;
  isMarketingTool?: boolean;
  prompt?: string | null;
}
export interface IGenerationImageLibModel extends IGeneralModel {
  minImages: number;
  maxImages: number;
  requirePrompt: boolean;
  credits: number;
}
export interface IGenerationVideoLibModel extends IGeneralModel {
  minImages: number;
  maxImages: number;
  requirePrompt: boolean;
  defaultVideoDuration: number;
  maxVideoDuration: number;
  credits: Map<string, number>[];
}
