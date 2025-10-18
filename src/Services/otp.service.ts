import otp_reids from "../Config/otp-reids";
import { COOL_DOWN_PERIOD, OTP_EXPIRE_SECONDS } from "../Constants/otp-redis";
import { OTPResponse, OTPVerificationResponse } from "../types/otp-response";
import AppError from "../Utils/Errors/AppError";

class OTPService {
  private cooldownKey: string;
  private otpKey: string;
  private incrementKey: string;

  constructor(private phoneNumber: string) {
    this.cooldownKey = `otp_cooldown:${phoneNumber}`;
    this.otpKey = `otp_value:${phoneNumber}`;
    this.incrementKey = `otp_increment:${phoneNumber}`;
  }

  async sendOTP(): Promise<OTPResponse> {
    const lastRequest = await otp_reids.get(this.cooldownKey);
    if (lastRequest) {
      const ttl = await otp_reids.ttl(this.cooldownKey);
      throw new AppError(
        `Please wait ${ttl} seconds before requesting a new OTP.`
      );
    }

    const incrementStr = await otp_reids.get(this.incrementKey);
    const increment = incrementStr ? parseInt(incrementStr) : 0;

    const coolDownPeriod = Math.floor(
      COOL_DOWN_PERIOD * Math.pow(2, increment)
    );
    const otp = this.generateOTP();
    await otp_reids.set(this.otpKey, otp, "EX", OTP_EXPIRE_SECONDS);
    await otp_reids.set(this.cooldownKey, "1", "EX", coolDownPeriod);
    
    await otp_reids.set(this.incrementKey, (increment + 1).toString(), "EX", 86400);

    console.log(
      `✅ OTP for ${this.phoneNumber}: ${otp} with coolDownPeriod: ${coolDownPeriod}s (increment: ${increment})`
    );

    return {
      message: "OTP sent successfully",
      OTP: otp,
      expiresIn: OTP_EXPIRE_SECONDS,
      nextRequestInSeconds: coolDownPeriod,
    };
  }

  async verifyOTP(otp: string): Promise<OTPVerificationResponse> {
    const storedOtp = await otp_reids.get(this.otpKey);
    if (!storedOtp) {
      throw new AppError("OTP expired or not found");
    }
    if (storedOtp !== otp) {
      throw new AppError("Invalid OTP");
    }

    await otp_reids.del(this.otpKey);
    await otp_reids.del(this.cooldownKey);
    await otp_reids.del(this.incrementKey); // Reset increment counter

    return { message: "OTP Verified Successfully!", isVerified: true };
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export default OTPService;
