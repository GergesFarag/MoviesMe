import mongoose, { Types } from "mongoose";

export interface ILanguage {
  _id:Types.ObjectId;
  name:string;
  accents:{_id: Types.ObjectId , name:string}[];
}
export interface IGenderOption {
  _id:Types.ObjectId;
  name:string;
}
export interface IStoryGenerationInfo {
  _id:mongoose.Schema.Types.ObjectId;
  location: {
    name: string;
    image: string;
  }[];
  style: {
    name: string;
    image: string;
  }[];
  genres: string[];
  estimatedTimePerSecond: number;
  languages: ILanguage[];
  genderOptions: IGenderOption[];
  voiceOverCredits: number;
  generationCredits: number;
  createdAt: Date;
  updatedAt: Date;
}
