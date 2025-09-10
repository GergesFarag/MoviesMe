export type genderType = "male" | "female" | "kid";
export interface IVoiceOver {
  voiceOverLyrics: string | null;
  voiceLanguage: string | null;
  voiceGender: genderType;
  sound: string | null;
  text: string | null;
}
export interface IStoryRequest {
  prompt: string;
  storyDuration: number;
  voiceOver?: IVoiceOver;
  storyLocationId?: string;
  storyStyleId?: string;
  storyTitle?: string;
  genere?: string;
  image?: string;
}
export type IStoryRequestKeys = keyof IStoryRequest;