export const QUEUE_NAMES = {
  STORY_PROCESSING: "storyProcessing",
  MODEL_PROCESSING: "modelProcessing",
  GENERATION_LIB: "generationLib",
} as const;

export const QUEUE_EVENTS = {
  STORY_PROGRESS: "story:progress",
  STORY_COMPLETED: "story:completed",
  STORY_FAILED: "story:failed",
  GENERATION_LIB_PROGRESS: "generationLib:progress",
  GENERATION_LIB_COMPLETED: "generationLib:completed",
  GENERATION_LIB_FAILED: "generationLib:failed",
} as const;

export const JOB_OPTIONS = {
  timeout: 1800000, // 30 minutes in milliseconds
  removeOnComplete: 10,
  removeOnFail: 5,
} as const;

export const QUEUE_SETTINGS = {
  stalledInterval: 30000,
} as const;

export const PROGRESS_STEPS = {
  VALIDATION: 10,
  STORY_GENERATION: 30,
  IMAGE_GENERATION: 50,
  VIDEO_GENERATION: 80,
  VIDEO_MERGE: 95,
  VIDEO_UPLOAD: 98,
  COMPLETION: 100,
} as const;