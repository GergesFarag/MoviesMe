import { Request, Response, NextFunction } from "express";
import catchError from "../Utils/Errors/catchError";
import { PurchasingService } from "../Services/purchasing.service";
import { RevenueCatConfig } from "../Interfaces/revenueCat.interface";
import AppError from "../Utils/Errors/AppError";
import { CreditService } from "../Services/credits.service";
import { NotificationService } from "../Services/notification.service";

const revenueCatConfig: RevenueCatConfig = {
  apiKey: process.env.REVENUECAT_API_KEY as string,
  baseUrl: process.env.REVENUECAT_BASE_URL || "https://api.revenuecat.com/v1",
};

const purchasingService = new PurchasingService(revenueCatConfig);
const creditService = new CreditService();
const purchasingController = {
  getSubscribers: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      try {
        const subscribers = await purchasingService.getAllSubscribers();

        res.status(200).json({
          message: "Users retrieved successfully",
          data: subscribers,
        });
      } catch (error) {
        throw error;
      }
    }
  ),
  getUserSubscriptions: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.params.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
      try {
        const subscriptions = await purchasingService.getUserSubscriptions(
          userId
        );
        res.status(200).json({
          message: "User subscriptions retrieved successfully",
          data: subscriptions,
        });
      } catch (error) {
        console.error("Error fetching user subscriptions:", error);
        throw new AppError("Failed to retrieve user subscriptions", 500);
      }
    }
  ),
  validateSpecificPurchase: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { event } = req.body;

      if (!event) {
        throw new AppError("Invalid request body", 400);
      }
      console.log("Received event:", event);
      const userId = event.app_user_id
      const credits =
        event.price_in_purchased_currency || event.adjustments[0].amount;
      if (!userId || !credits) {
        throw new AppError("Missing required event data", 400);
      }
      const updatedCredits = await creditService.addCredits(
        event.app_user_id,
        event.price_in_purchased_currency || event.adjustments[0].amount
      );
      if (!updatedCredits) {
        throw new AppError("Failed While Updating User Credits", 400);
      }
      const notificationService = new NotificationService();
        await notificationService.sendTransactionalSocketNotification(
          userId,
          {
            userCredits: await creditService.getCredits(userId),
          }
        );
      res.status(200).json({
        message: `Purchase validated successfully , ${event.price_in_purchased_currency} credits added`,
        data: {
          totalUserCredits: await creditService.getCredits(event.app_user_id),
          isValid: true,
        },
      });
    }
  ),
};
export default purchasingController;
