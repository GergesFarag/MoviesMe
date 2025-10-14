import { Request, Response, NextFunction } from "express";
import catchError from "../Utils/Errors/catchError";
import { PurchasingService } from "../Services/purchasing.service";
import { RevenueCatConfig } from "../Interfaces/revenueCat.interface";
import AppError from "../Utils/Errors/AppError";
import { CreditService } from "../Services/credits.service";
import {
  NotificationData,
  NotificationService,
} from "../Services/notification.service";
import { TranslationService } from "../Services/translation.service";
import User from "../Models/user.model";
import { getUserLangFromDB } from "../Utils/Format/languageUtils";

const revenueCatConfig: RevenueCatConfig = {
  apiKey: process.env.REVENUECAT_API_KEY as string,
  baseUrl: process.env.REVENUECAT_BASE_URL || "https://api.revenuecat.com/v1",
};

const purchasingService = new PurchasingService(revenueCatConfig);
const creditService = new CreditService();
const translationService = TranslationService.getInstance();
const notificationService = new NotificationService();

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
      if (event.type === "VIRTUAL_CURRENCY_TRANSACTION") {
        const userId = event.app_user_id;
        const user = await User.findById(userId);
        const credits = event.adjustments[0].amount;
        if (!userId || !credits) {
          throw new AppError("Missing required event data", 400);
        }
        const updatedCredits = await creditService.addCredits(userId, credits);
        if (!updatedCredits) {
          throw new AppError("Failed While Updating User Credits", 400);
        }
        await notificationService.sendTransactionalSocketNotification(userId, {
          userCredits: await creditService.getCredits(userId),
        });
        let notification: NotificationData = {
          title: translationService.translateText(
            "notifications.transaction.completion",
            "title",
            "en"
          ),
          message: translationService.translateText(
            "notifications.transaction.completion",
            "message",
            "en",
            { credits }
          ),
          data: {
            userCredits: await creditService.getCredits(userId),
            status: "completed",
          },
          category: "transactions",
          redirectTo: "/transactions",
        };
        await notificationService.saveNotificationToUser(user, notification);

        const translatedNotification: NotificationData = {
          ...notification,
          title: translationService.translateText(
            "notifications.transaction.completion",
            "title",
            user?.preferredLanguage || "en"
          ),
          message: translationService.translateText(
            "notifications.transaction.completion",
            "message",
            user?.preferredLanguage || "en",
            { credits }
          ),
        };

        await notificationService.sendPushNotificationToUser(
          userId,
          translatedNotification
        );

        res.status(200).json({
          message: `Purchase validated successfully , ${credits} credits added`,
          data: {
            totalUserCredits: await creditService.getCredits(userId),
            isValid: true,
          },
        });
      }else{
        res.status(200).json({
          message: `Event type ${event.type} ignored`,
          data: {
            isValid: false,
          },
        });
      }
    }
  ),
};
export default purchasingController;
