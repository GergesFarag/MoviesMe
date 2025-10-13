import { Router } from "express";
import { authMiddle } from "../Middlewares/auth.middleware";
import purchasingController from "../Controllers/purchase.controller";

const router = Router();

router.get("/subscribers", authMiddle, purchasingController.getSubscribers);
router.post("/validate", authMiddle, purchasingController.validateSpecificPurchase);
router.get("/subscribers/:userId", authMiddle, purchasingController.getUserSubscriptions);

export default router;