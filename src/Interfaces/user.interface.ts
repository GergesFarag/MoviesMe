import { ObjectId } from "mongoose";
import { IItem } from "./item.interface";
import { INotification } from "./notification.interface";

export interface IUser {
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  firebaseUid: string;
  phoneNumber?: string | null;
  email?: string | null;
  dob?: Date | null;
  age?: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  items?: IItem[];
  jobs?: { _id: ObjectId; jobId: string }[];
  stories?: ObjectId[];
  notifications?: INotification[] | null;
  userLocation?: string | null;
  isMale?: boolean | null;
  profilePicture?: string | null;
  credits?: number | null;
  FCMToken?: string | null;
}
