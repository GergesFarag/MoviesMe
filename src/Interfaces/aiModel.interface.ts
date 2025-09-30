export default interface IAiModel {
  name: string;
  thumbnail: string;
  previewUrl: string;
  isVideo: boolean;
  credits: number;
  isNewModel: boolean;
  isTrending: boolean;
  minImages: number;
  maxImages: number;
  wavespeedCall: string;
  isVideoEffect?: boolean;
  isImageEffect?: boolean;
  isCharacterEffect?: boolean;
  isAITool?: boolean;
  isAI3DTool?: boolean;
  isMarketingTool?: boolean;
  prompt?: string | null;
}
