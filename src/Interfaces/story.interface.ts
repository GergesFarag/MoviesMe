import mongoose from "mongoose";
import { IScene } from "./scene.interface";

export interface IStory{
    title:string;
    userId:mongoose.Schema.Types.ObjectId;
    scenes:IScene[];
}