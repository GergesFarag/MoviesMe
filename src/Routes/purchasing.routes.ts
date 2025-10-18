import { Router } from "express";
import { authMiddle } from "../Middlewares/auth.middleware";
import paymentController from "../Controllers/purchase.controller";
import verifyWebhookSignature from "../Middlewares/revenueCat.middleware";

const router = Router();

router.post(
  "/validatePurchasing",
  verifyWebhookSignature,
  paymentController.validateSpecificPurchase
);
router.post(
  "/refund",
  verifyWebhookSignature,
  paymentController.refundPurchase
);
router.post("/rewardCredits", authMiddle, paymentController.rewardCredits);
router.get("/subscribers", authMiddle, paymentController.getSubscribers);
router.get(
  "/subscribers/:userId",
  authMiddle,
  paymentController.getUserSubscriptions
);

export default router;
