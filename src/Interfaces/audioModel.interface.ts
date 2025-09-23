export interface IAudioModel {
  _id: string;
  elevenLabsId: string;
  name: string;
  gender: "male" | "female" | "kid";
  language: string;
  thumbnail?: string;
}

export interface IProcessedVoiceOver {
  url: string;
  text: string;
  data: any;
}
