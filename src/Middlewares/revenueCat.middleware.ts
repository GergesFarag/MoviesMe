import e, { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";
import { error } from "console";
function verifyWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let signature = req.headers["x-revenuecat-signature"] as string;
  if (!signature) {
    return res
      .status(401)
      .json({ message: "Unauthorized", error: "Missing signature" });
  }
  signature = signature.split(" ")[1];
  const expectedSignature = createHmac(
    "sha256",
    process.env.REVENUECAT_WEBHOOK_SECRET as string
  )
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (signature !== expectedSignature) {
    return res
      .status(401)
      .json({ message: "Unauthorized", error: "Invalid signature" });
  }

  next();
}
export default verifyWebhookSignature;