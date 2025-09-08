import mongoose from "mongoose";
import { IScene } from "./scene.interface";
import { jobStatus } from "./job.interface";
export interface IStory {
  title: string;
  prompt:string;
  status: jobStatus;
  thumbnail: string;
  isFav:boolean;
  videoUrl:string;
  duration:number;
  numberOfScenes:number;
  style:string;
  location:string;
  genre:string;
  scenes: IScene[];
  userId: mongoose.Schema.Types.ObjectId;
}

