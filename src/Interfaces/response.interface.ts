import { IUser } from "./user.interface";

export interface loginResponse {
  message: string;
  data: {
    user: {
      id: string;
      username: string;
      isAdmin: boolean;
      credits?: number;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export type UserProfileResponseDataKeys = 
  | "username"
  | "email"
  | "phoneNumber"
  | "credits"
  | "userLocation"
  | "dob"
  | "isMale"
  | "profilePicture"
export interface userProfileResponse {
  message: string;
  data: Record<UserProfileResponseDataKeys, any>;
}
