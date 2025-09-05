export type genderType = "male" | "female" | "kid";
export interface IStoryRequest {
  prompt: string;
  storyDuration: number;
  voiceOver?: {
    voiceOverLyrics: string | null;
    voiceLanguage: string | null;
    voiceGender: genderType;
  };
  storyLocationId?: string;
  storyStyleId?: string;
  storyTitle?: string;
  genere?: string;
  image?: string;
}
