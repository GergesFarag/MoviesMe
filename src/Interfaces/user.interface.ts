import { ObjectId } from "mongoose";

export interface IUser {
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  firebaseUid:string;
  phoneNumber?: string;
  email?: string;
  favs?: ObjectId[];
  dob?: Date;
  age?: number;
  createdAt?: Date;
  updatedAt?: Date;
  videos?: ObjectId[];
  stories?: ObjectId[];
  userLocation?: string;
  gender?: string;
  profilePicture?: string;
  credits?: number;
}