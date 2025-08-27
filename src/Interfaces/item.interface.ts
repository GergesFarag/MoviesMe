import { jobStatus } from "./job.interface";

export interface IItem {
  URL:string;
  modelType?:string;
  modelName:string;
  isVideo:string;
  modelThumbnail:string;
  jobId:string;
  status:jobStatus;
  isFav:boolean;
  duration:number;
  createdAt: Date;
  updatedAt: Date;
}
