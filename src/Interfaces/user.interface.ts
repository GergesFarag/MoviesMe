import { ObjectId } from "mongoose";

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
  videos?: ObjectId[];
  stories?: ObjectId[];
  userLocation?: string|null;
  isMale?: boolean|null;
  profilePicture?: string|null;
  credits?: number|null;
}