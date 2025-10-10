import { Router } from "express";
import { authMiddle } from "../Middlewares/auth.middleware";
import purchasingController from "../Controllers/purchase.controller";

const router = Router();

router.get("/subscribers", authMiddle, purchasingController.getSubscribers);
router.get("/subscribers/:userId", authMiddle, purchasingController.getUserSubscriptions);
router.get("/validate/:userId/:transactionId", authMiddle, purchasingController.validateSpecificPurchase);

export default router;