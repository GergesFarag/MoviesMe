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
