import IAiModel from "../../Interfaces/aiModel.interface";

export const filterModelType = (model:IAiModel):string => {
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
export const modelTypeMapper = {
  "videoEffects" : "video-effects",
  "imageEffects" : "image-effects",
  "characterEffects" : "character-effects",
  "ai3dTools" : "wavespeed-ai",
  "aiTools" : "wavespeed-ai",
  "scenarioMarketing" : "scenario-marketing",
}
export const reverseModelTypeMapper = Object.fromEntries(
  Object.entries(modelTypeMapper).map(([key, value]) => [value, key])
);
export type ModelType = keyof typeof modelTypeMapper;
