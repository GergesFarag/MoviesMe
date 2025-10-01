interface IGeneralModel extends Document {
  name: string;
  thumbnail: string;
  isVideo: boolean;
  credits: number;
  wavespeedCall: string;
}
export default interface IAiModel extends IGeneralModel {
  previewUrl: string;
  isNewModel: boolean;
  isTrending: boolean;
  minImages: number;
  maxImages: number;
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
}
export interface IGenerationVideoLibModel extends IGeneralModel {
  minImages: number;
  maxImages: number;
  requirePrompt: boolean;
  defaultVideoDuration: number;
  maxVideoDuration: number;
}
