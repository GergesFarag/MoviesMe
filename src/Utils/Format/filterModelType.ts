import IAiModel from "../../Interfaces/aiModel.interface";

export const filterModelType = (model:IAiModel):string => {
  if (model.isImageEffect && model.name === "portrait") {
    return "bytedance";
  }
  if (model.isImageEffect) {
    return "image-effects";
  }
  if (model.isVideoEffect) {
    return "video-effects";
  }
  if (model.isCharacterEffect) {
    return "character-effects";
  }
  if (model.isAITool || model.isAI3DTool) {
    return "wavespeed-ai";
  }
  if (model.isMarketingTool) {
    return "scenario-marketing";
  }
  return "unknown";
}