
export const GENERATION_LIB_EVENTS = {
  PROGRESS: "generationLib:progress",
  
  COMPLETED: "generationLib:completed",
  
  FAILED: "generationLib:failed",

  USER_ROOM: (userId: string) => `user:${userId}`,
} as const;
