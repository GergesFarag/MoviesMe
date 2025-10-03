export interface IAudioModel {
  _id: string;
  elevenLabsId: string;
  name: string;
  gender: "male" | "female" | "kid";
  language: string;
  accent?: string;
  thumbnail?: string;
}

export interface IProcessedVoiceOver {
  url: string|null;
  text: string|null;
  data: any|null;
}
