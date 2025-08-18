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
export interface userProfileResponse{
  message: string;
  data: {
    
  };
}