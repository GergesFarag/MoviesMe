import { Document } from "mongoose";
import { IGenerationImageLibModel, IGenerationVideoLibModel } from "./aiModel.interface";

export interface IGenerationInfo extends Document {
  imageModels: IGenerationImageLibModel[];
  videoModels: IGenerationVideoLibModel[];
}
