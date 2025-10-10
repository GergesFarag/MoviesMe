export interface IVoiceOver {
  voiceOverLyrics: string | null;
  voiceLanguage: string | null;
  voiceGender: string;
  voiceAccent: string | null;
  sound: string | null;
  text: string | null;
}
export interface IStoryRequest {
  prompt: string;
  storyDuration: number;
  credits: number;
  voiceOver?: IVoiceOver;
  storyLocationId?: string;
  storyStyleId?: string;
  storyTitle?: string;
  genere?: string;
  image?: string;
  audio?: string;
}
export type IStoryRequestKeys = keyof IStoryRequest;