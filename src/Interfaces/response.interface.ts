
export interface loginResponse {
  message: string;
  data: {
    user: {
      id: string;
      username: string;
      isAdmin: boolean;
      credits: number;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export type UserProfileNonSelectableFields = 
  "-isActive"|
  "-isAdmin"|
  "-firebaseUid"|
  "-FCMToken"|
  "-preferredLanguage"|
  "-__v"|
  "-effectsLib"|
  "-storiesLib"|
  "-generationLib"|
  "-jobs"|
  "-notifications"
  
export interface userProfileResponse {
  message: string;
  data: Record<any, any>;
}
