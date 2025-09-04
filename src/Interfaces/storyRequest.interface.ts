export interface IStoryRequest {
  prompt: string;
  storyDuration: number;
  voiceOver?: {
    voiceOverLyrics: string | null;
    voiceLanguage: string;
    voiceGender: "male" | "female" | "kid";
  };
  storyLocationId?: string;
  storyStyleId?: string;
  storyTitle?: string;
  genere?: string;
  image?: string;
}
