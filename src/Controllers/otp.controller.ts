import OTPService from "../Services/otp.service";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
export const requestOtp = catchError(async (req, res) => {
  const {phoneNumber} = req.body
  if(!phoneNumber) throw new AppError('Phone number is required!')
  const otpService = OTPService.getInstance(phoneNumber);
  const response = await otpService.sendOTP();
  res.status(200).json(response);
});
export const verifyOtp = catchError(async (req, res) => {
  const { otp , phoneNumber } = req.body;
  if(!otp||!phoneNumber){
    throw new AppError("OTP and Phone number are Required!");
  }
  const otpService = OTPService.getInstance(phoneNumber);
  const response = await otpService.verifyOTP(phoneNumber,otp);
   res.status(200).json(response);
});
