export type OTPResponse = {
  message: string;
  expiresIn: number;
  nextRequestInSeconds: number;
  OTP?:string;
};
export type OTPVerificationResponse = {
  message: string;
  isVerified: true;
  token: string;
};