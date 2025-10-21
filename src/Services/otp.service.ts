import otp_reids from "../Config/otp-reids";
import twilioVerification from "../Config/twilio";
import {
  COOL_DOWN_PERIOD,
  TWILIO_OTP_EXPIRATION,
} from "../Constants/otp-redis";
import { OTPChannel } from "../Enums/opt.enum";
import { OTPResponse, OTPVerificationResponse } from "../types/otp";
import AppError from "../Utils/Errors/AppError";
import logger from "../Config/logger";
import { firebaseAdmin } from "../Config/firebase";

export class OTPService {
  private cooldownKey: string;
  private incrementKey: string;

  constructor(private phoneNumber: string) {
    this.cooldownKey = `otp_cooldown:${phoneNumber}`;
    this.incrementKey = `otp_increment:${phoneNumber}`;
  }

  async sendOTP(channel: OTPChannel): Promise<OTPResponse> {
    const lastRequest = await otp_reids.get(this.cooldownKey);
    if (lastRequest) {
      const ttl = await otp_reids.ttl(this.cooldownKey);
      return {
        message: "Please wait before requesting a new OTP",
        expiresIn: TWILIO_OTP_EXPIRATION,
        nextRequestInSeconds: ttl,
      };
    }

    const incrementStr = await otp_reids.get(this.incrementKey);
    const increment = incrementStr ? parseInt(incrementStr) : 0;

    const verification = await twilioVerification.verifications.create({
      to: this.phoneNumber,
      channel: channel,
    });

    if (!verification) throw new AppError("Error While Verification!");

    logger.info({
      message: "Verification sent",
      sid: verification.sid,
      to: verification.to,
      channel: verification.channel,
      status: verification.status,
    });

    const coolDownPeriod = Math.floor(
      COOL_DOWN_PERIOD * Math.pow(2, increment)
    );
    await otp_reids.set(
      this.incrementKey,
      (increment + 1).toString(),
      "EX",
      3600
    );

    await otp_reids.set(this.cooldownKey, "1", "EX", coolDownPeriod);

    return {
      message: "OTP sent successfully",
      expiresIn: TWILIO_OTP_EXPIRATION,
      nextRequestInSeconds: coolDownPeriod,
    };
  }

  async verifyOTP(otp: string): Promise<OTPVerificationResponse> {
    const verificationCheck =
      await twilioVerification.verificationChecks.create({
        to: this.phoneNumber,
        code: otp,
      });

    logger.info({
      message: "Verification check result",
      verificationCheck,
    });

    if (verificationCheck.status !== "approved") {
      throw new AppError("Invalid or expired OTP");
    }
    await otp_reids.del(this.cooldownKey);
    await otp_reids.del(this.incrementKey);
    const customToken = await firebaseAdmin
      .auth()
      .createCustomToken(this.phoneNumber);
    console.log("Custom Token", customToken);
    return {
      message: "OTP Verified Successfully!",
      isVerified: true,
      token: customToken,
    };
  }
}
