import { Request, Response, NextFunction } from "express";
import catchError from "../Utils/Errors/catchError";
import { PurchasingService } from "../Services/purchasing.service";
import { RevenueCatConfig } from "../Interfaces/revenueCat.interface";
import AppError from "../Utils/Errors/AppError";
import { CreditService } from "../Services/credits.service";
import { NotificationService } from "../Services/notification.service";
import { TranslationService } from "../Services/translation.service";
import User from "../Models/user.model";
import mongoose from "mongoose";
import {
  INotification,
  TransactionNotificationData,
} from "../Interfaces/notification.interface";

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
        const user = await User.findById(
          mongoose.Types.ObjectId.createFromHexString(userId)
        );
        const credits = event.adjustments[0].amount;
        if (!userId || !credits) {
          throw new AppError("Missing required event data", 400);
        }
        const updatedCredits = await creditService.addCredits(userId, credits);
        if (!updatedCredits) {
          throw new AppError("Failed While Updating User Credits", 400);
        }
        const userCredits = await creditService.getCredits(userId);

        await notificationService.sendTransactionalSocketNotification(userId, {
          userCredits,
        });

        // Create properly typed transaction notification data
        const notificationData: TransactionNotificationData = {
          type: "transaction",
          status: "completed",
          userId,
          userCredits,
          amount: credits,
        };

        const notification: INotification = {
          title: translationService.translateText(
            "notifications.transaction.completion",
            "title",
            "en"
          ),
          message: `${credits} credits added to your account.\n ${translationService.translateText(
            "notifications.transaction.completion",
            "message",
            "en"
          )}`,
          data: notificationData,
          category: "transactions",
          redirectTo: "/transactions",
        };
        console.log("Notification Saved in DB", notification);
        await notificationService.saveNotificationToUser(user, notification);

        const translatedNotification: INotification = {
          ...notification,
          title: translationService.translateText(
            "notifications.transaction.completion",
            "title",
            user?.preferredLanguage || "en"
          ),
          message: translationService
            .translateText(
              "notifications.transaction.completion",
              "message",
              user?.preferredLanguage || "en"
            )
            .concat(` ${credits} credits added.`),
        };

        await notificationService.sendPushNotificationToUser(
          userId,
          translatedNotification
        );
        console.log("Push notification data : ", translatedNotification);

        res.status(200).json({
          message: `Purchase validated successfully , ${credits} credits added`,
          data: {
            totalUserCredits: await creditService.getCredits(userId),
            isValid: true,
          },
        });
      } else {
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
