import otp_reids from "../Config/otp-reids";
import {
  COOL_DOWN_PERIOD,
  INCREMENT_VALUE,
  OTP_EXPIRE_SECONDS,
} from "../Constants/otp-redis";
import { OTPResponse, OTPVerificationResponse } from "../types/otp-response";
import AppError from "../Utils/Errors/AppError";

class OTPService {
  private cooldownKey: string;
  private otpKey: string;
  private coolDownPeriod: number;
  private static instance: OTPService;
  private constructor(phoneNumber: string) {
    this.cooldownKey = `otp_cooldown:${phoneNumber}`;
    this.otpKey = `otp_value:${phoneNumber}`;
    this.coolDownPeriod = COOL_DOWN_PERIOD;
  }

  async sendOTP(): Promise<OTPResponse> {
    const lastRequest = await otp_reids.get(this.cooldownKey);
    if (lastRequest) {
      const ttl = await otp_reids.ttl(this.cooldownKey);
      throw new AppError(
        `Please wait ${ttl} seconds before requesting a new OTP.`
      );
    }
    const otp = this.generateOTP();
    await otp_reids.set(this.otpKey, otp, "EX", OTP_EXPIRE_SECONDS);
    await otp_reids.set(this.cooldownKey, "1", "EX", Math.floor(this.coolDownPeriod));
    console.log(
      `✅ OTP for: ${otp} with coolDownPeriod : ${this.coolDownPeriod}`
    );
    this.coolDownPeriod = Math.floor(this.coolDownPeriod * INCREMENT_VALUE);
    return {
      message: "OTP sent successfully",
      OTP : otp,
      expiresIn: OTP_EXPIRE_SECONDS,
      nextRequestInSeconds: this.coolDownPeriod,
    };
  }

  async verifyOTP(
    phoneNumber: string,
    otp: string
  ): Promise<OTPVerificationResponse> {
    const otp_key = `otp_value:${phoneNumber}`;
    const storedOtp = await otp_reids.get(otp_key);
    if (!storedOtp) {
      throw new AppError("OTP expired or not found");
    }
    if (storedOtp !== otp) {
      throw new AppError("Invalid OTP");
    }
    await otp_reids.del(otp_key);
    return { message: "OTP Verified Successfully!", isVerified: true };
  }

  public static getInstance(phoneNumber: string): OTPService {
    if (!OTPService.instance) {
      OTPService.instance = new OTPService(phoneNumber);
    }
    return OTPService.instance;
  }

  private generateOTP(): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return otp;
  }
}
export default OTPService;
