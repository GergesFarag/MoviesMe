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
  signature = signature.split(" ")[1];
  
  const webhookSecret = String(process.env.REVENUECAT_WEBHOOK_SECRET);
  if (!webhookSecret) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not configured in environment variables");
    return res
      .status(500)
      .json({ message: "Server configuration error", error: "Webhook secret not configured" });
  }
  console.log("Webhook Secret" , webhookSecret);
  console.log("Signature" , signature);
  const expectedSignature = createHmac(
    "sha256",
    webhookSecret
  )
    .update(JSON.stringify(req.body))
    .digest("hex");

  console.log(
    "Expected Signature",
    expectedSignature,
    "Received Signature",
    signature
  );
  if (signature !== expectedSignature) {
    return res
      .status(401)
      .json({ message: "Unauthorized", error: "Invalid signature" });
  }
  console.log("PASSED!!!");
  next();
}
export default verifyWebhookSignature;
