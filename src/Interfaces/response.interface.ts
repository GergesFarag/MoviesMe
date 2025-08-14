export interface loginResponse {
  message: string;
  data: {
    user: {
      id: string;
      username: string;
      isAdmin: boolean;
    };
    accessToken: string;
    refreshToken: string;
  };
}
