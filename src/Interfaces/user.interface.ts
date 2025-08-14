import { ObjectId } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  age?: number;
  phoneNumber?: string;
  firebaseUid:string;
  isAdmin: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isActive: boolean;
  videos?: ObjectId[];
  stories?: ObjectId[];
  userLocation?: string;
  gender?: string;
  dob: Date;
  profilePicture?: string;
  favs: ObjectId[];
}