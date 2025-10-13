import { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";

function verifyWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let signature = req.headers.authorization as string;
  if (!signature) {
    return res
      .status(401)
      .json({ message: "Unauthorized", error: "Missing signature" });
  }

  signature = signature.split(" ")[1].trim();
  
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not configured in environment variables");
    return res
      .status(500)
      .json({ message: "Server configuration error", error: "Webhook secret not configured" });
  }

  if (signature !== webhookSecret) {
    return res
      .status(401)
      .json({ 
        message: "Unauthorized", 
        error: "Invalid signature",
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            expected: webhookSecret,
            received: signature
          }
        })
      });
  }
  
  console.log("✅ WEBHOOK SIGNATURE VERIFIED - PASSED!!!");
  next();
}
export default verifyWebhookSignature;
