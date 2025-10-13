import { Router } from "express";
import { authMiddle } from "../Middlewares/auth.middleware";
import purchasingController from "../Controllers/purchase.controller";
import verifyWebhookSignature from "../Middlewares/revenueCat.middleware";

const router = Router();

router.post("/validate", verifyWebhookSignature, purchasingController.validateSpecificPurchase);
router.get("/subscribers", authMiddle, purchasingController.getSubscribers);
router.get("/subscribers/:userId", authMiddle, purchasingController.getUserSubscriptions);

export default router;