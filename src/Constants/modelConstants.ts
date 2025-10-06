export const JOB_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  PROCESSING: "processing",
} as const;
export const MODEL_TYPE = {
  BYTEDANCE: "bytedance",
  IMAGE_EFFECTS: "image-effects",
  VIDEO_EFFECTS: "video-effects",
} as const;
export const MODEL_FILTER_TYPE = {
  VIDEO: "isVideoEffect",
  IMAGE: "isImageEffect",
  AI_TOOL: "isAITool",
  CHARACTER: "isCharacterEffect",
  AI_3D_TOOL: "isAI3DTool",
  MARKETING_TOOL: "isMarketingTool",
  TRENDING: "isTrending",
  NEW: "isNew",
  FAVORITE: "isFavorite",
} as const;
export const QUERY_TYPE_TO_FILTER: Record<string, string> = {
  videoEffects: MODEL_FILTER_TYPE.VIDEO,
  imageEffects: MODEL_FILTER_TYPE.IMAGE,
  characterEffects: MODEL_FILTER_TYPE.CHARACTER,
  aiTools: MODEL_FILTER_TYPE.AI_TOOL,
  ai3DTools: MODEL_FILTER_TYPE.AI_3D_TOOL,
  marketingTools: MODEL_FILTER_TYPE.MARKETING_TOOL,
};
export const UPLOAD_PATHS = {
  USER_IMAGES: (userId: string) => `user_${userId}/images/uploaded`,
  USER_VIDEOS: (userId: string) => `user_${userId}/videos/uploaded`,
} as const;
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
} as const;

export const SORT_DEFAULTS = {
  SORT_BY: "newest",
} as const;

export const CATEGORY_DEFAULTS = {
  ALL: "all",
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];
export type ModelType = typeof MODEL_TYPE[keyof typeof MODEL_TYPE];
export type ModelFilterType = typeof MODEL_FILTER_TYPE[keyof typeof MODEL_FILTER_TYPE];

export type QueryType = keyof typeof QUERY_TYPE_TO_FILTER;