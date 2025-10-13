import { Router } from "express";
import { authMiddle } from "../Middlewares/auth.middleware";
import purchasingController from "../Controllers/purchase.controller";
import verifyWebhookSignature from "../Middlewares/revenueCat.middleware";

const router = Router();

router.get("/subscribers", authMiddle, purchasingController.getSubscribers);
router.post("/validate", authMiddle , verifyWebhookSignature, purchasingController.validateSpecificPurchase);
router.get("/subscribers/:userId", authMiddle, purchasingController.getUserSubscriptions);

export default router;