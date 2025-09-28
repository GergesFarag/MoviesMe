import { Types } from "mongoose";

export interface ILanguage {
  _id:Types.ObjectId;
  name:string;
  accents:{_id: Types.ObjectId , name:string}[];
}
export interface generationInfo {
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
  voiceOverCredits: number;
  generationCredits: number;
  createdAt: Date;
  updatedAt: Date;
}
