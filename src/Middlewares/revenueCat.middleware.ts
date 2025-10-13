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
  
  // Extract signature - RevenueCat sends it as "Bearer <signature>"
  signature = signature.replace(/^Bearer\s+/i, '').trim();
  
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not configured in environment variables");
    return res
      .status(500)
      .json({ message: "Server configuration error", error: "Webhook secret not configured" });
  }
  
  // Use rawBody if available, otherwise stringify the parsed body
  const bodyString = req.rawBody || JSON.stringify(req.body);
  
  console.log("🔐 Webhook Secret (first 10 chars):", webhookSecret.substring(0, 10) + "...");
  console.log("📝 Signature from header:", signature);
  console.log("📦 Body string length:", bodyString.length);
  
  const expectedSignature = createHmac(
    "sha256",
    webhookSecret
  )
    .update(bodyString)
    .digest("hex");

  console.log("🔍 Expected Signature:", expectedSignature);
  console.log("📨 Received Signature:", signature);
  console.log("✅ Signatures match:", signature === expectedSignature);
  
  if (signature !== expectedSignature) {
    console.error("❌ Signature verification failed!");
    console.error("   Expected:", expectedSignature);
    console.error("   Received:", signature);
    return res
      .status(401)
      .json({ 
        message: "Unauthorized", 
        error: "Invalid signature",
        // Only include in development
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            expected: expectedSignature,
            received: signature
          }
        })
      });
  }
  
  console.log("✅ WEBHOOK SIGNATURE VERIFIED - PASSED!!!");
  next();
}
export default verifyWebhookSignature;
