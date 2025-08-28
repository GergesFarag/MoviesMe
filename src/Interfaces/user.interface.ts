import { ObjectId } from "mongoose";
import { IItem } from "./item.interface";

export interface IUser {
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  firebaseUid:string;
  phoneNumber?: string|null;
  email?: string|null;
  favs?: String[];
  dob?: Date|null;
  age?: number|null;
  createdAt?: Date|null;
  updatedAt?: Date|null;
  items?: IItem[];
  jobs?: ObjectId[];
  stories?: ObjectId[];
  userLocation?: string|null;
  isMale?: boolean|null;
  profilePicture?: string|null;
  credits?: number|null;
  FCMToken?: string|null;
}