import { ObjectId } from "mongoose";
import { IVideo } from "./video.interface";

export interface IUser {
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  firebaseUid:string;
  phoneNumber?: string|null;
  email?: string|null;
  favs?: ObjectId[];
  dob?: Date|null;
  age?: number|null;
  createdAt?: Date|null;
  updatedAt?: Date|null;
  videos?: IVideo[];
  images?: ObjectId[];
  stories?: ObjectId[];
  userLocation?: string|null;
  isMale?: boolean|null;
  profilePicture?: string|null;
  credits?: number|null;
  FCMToken?: string|null;
}