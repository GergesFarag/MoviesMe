import OTPService from "../Services/otp.service";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
export const requestOtp = catchError(async (req, res) => {
  const userId = req.user?.id;
  const otpService = OTPService.getInstance(userId);
  const response = await otpService.sendOTP();
  res.status(200).json(response);
});
export const verifyOtp = catchError(async (req, res) => {
  const { otp } = req.body;
  if(!otp){
    throw new AppError("OTP is Required!");
  }
  const userId = req.user?.id;
  const otpService = OTPService.getInstance(userId);
  const response = await otpService.verifyOTP(userId,otp);
   res.status(200).json(response);
});
