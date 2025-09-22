export interface IAudioModel {
  elevenLabsId: string;
  name: string;
  gender: "male" | "female";
  thumbnail?: string;
}

export interface IProcessedVoiceOver {
  url: string;
  text: string;
  data: any;
}
