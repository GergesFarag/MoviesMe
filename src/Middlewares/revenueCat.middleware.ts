import { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";
function verifyWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let signature = req.headers["Authorization"] as string;
  console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
  console.log("Received Signature:", signature);
  console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
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
  console.log(
    "Expexted Signature",
    expectedSignature,
    "Received Signature",
    signature
  );
  if (signature !== expectedSignature) {
    return res
      .status(401)
      .json({ message: "Unauthorized", error: "Invalid signature" });
  }

  next();
}
export default verifyWebhookSignature;
