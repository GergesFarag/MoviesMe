import { Document } from "mongoose";

export interface IGenerationInfo extends Document {
    creditsPerImage : number;
    creditsPerVideo : number;
    defaultVideoDuration : number;
    maxVideoDuration : number;
}