import { Request, Response, NextFunction } from 'express';
import catchError from '../Utils/Errors/catchError';
import { PaymentService } from '../Services/payment.service';
import { RevenueCatConfig } from '../Interfaces/revenueCat.interface';
import AppError from '../Utils/Errors/AppError';
import { CreditService } from '../Services/credits.service';
import { NotificationService } from '../Services/notification.service';
import { TranslationService } from '../Services/translation.service';
import User from '../Models/user.model';
import mongoose from 'mongoose';
import {
  INotification,
  TransactionNotificationData,
} from '../Interfaces/notification.interface';
import { CREDITS_AD_AWARD } from '../Constants/credits';

const revenueCatConfig: RevenueCatConfig = {
  apiKey: process.env.REVENUECAT_API_KEY as string,
  baseUrl: process.env.REVENUECAT_BASE_URL || 'https://api.revenuecat.com/v1',
};

const paymentService = new PaymentService(revenueCatConfig);
const creditService = CreditService.getInstance();
const translationService = TranslationService.getInstance();
const notificationService = NotificationService.getInstance();

const paymentController = {
  getSubscribers: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      try {
        const subscribers = await paymentService.getAllSubscribers();

        res.status(200).json({
          message: 'Users retrieved successfully',
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
        throw new AppError('User not authenticated', 401);
      }
      try {
        const subscriptions = await paymentService.getUserSubscriptions(userId);
        res.status(200).json({
          message: 'User subscriptions retrieved successfully',
          data: subscriptions,
        });
      } catch (error) {
        console.error('Error fetching user subscriptions:', error);
        throw new AppError('Failed to retrieve user subscriptions', 500);
      }
    }
  ),
  validateSpecificPurchase: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { event } = req.body;
      if (!event) {
        throw new AppError('Invalid request body', 400);
      }
      if (event.type === 'VIRTUAL_CURRENCY_TRANSACTION') {
        const userId = event.app_user_id;
        const credits = event.adjustments[0].amount;
        if (!userId || !credits) {
          throw new AppError('Missing required event data', 400);
        }
        const user = await User.findById(
          mongoose.Types.ObjectId.createFromHexString(userId)
        );
        const locale = event.subscriber_attributes.locale.value as string;
        if (!user) throw new AppError('no user found', 404);
        user.preferredLanguage = locale;
        await user.save();
        const updatedCredits = await creditService.addCredits(userId, credits);
        if (!updatedCredits) {
          throw new AppError('Failed While Updating User Credits', 400);
        }
        const userCredits = await creditService.getCredits(userId);

        await notificationService.sendTransactionalSocketNotification(userId, {
          userCredits,
        });

        const notificationData: TransactionNotificationData = {
          type: 'transaction',
          status: 'completed',
          userId,
          userCredits,
          amount: credits,
        };

        const notification: INotification = {
          title: translationService.translateText(
            'notifications.transaction.completion',
            'title',
            'en'
          ),
          message: `${translationService.translateText(
            'notifications.transaction.completion',
            'message',
            'en',
            { credits }
          )}`,
          data: notificationData,
          category: 'transactions',
          redirectTo: '/transactions',
        };
        console.log('Notification Saved in DB', notification);
        await notificationService.saveNotificationToUser(user, notification);

        const translatedNotification: INotification = {
          ...notification,
          title: translationService.translateText(
            'notifications.transaction.completion',
            'title',
            user.preferredLanguage || 'en'
          ),
          message: translationService.translateText(
            'notifications.transaction.completion',
            'message',
            user.preferredLanguage || 'en',
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
  refundPurchase: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const { event } = req.body;
      console.log('EVENT FROM REFUNDING : ', event);
      res.status(200).json({
        message: `Refund event received and processed`,
      });
    }
  ),
  rewardCredits: catchError(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;
      const updatedCredits = await creditService.addCredits(userId, 1);
      if (!updatedCredits) {
        throw new AppError('Failed While Updating User Credits', 400);
      }
      const userCredits = await creditService.getCredits(userId);
      const notificationData: TransactionNotificationData = {
        type: 'transaction',
        status: 'completed',
        userId,
        userCredits,
        amount: CREDITS_AD_AWARD,
      };

      const notification: INotification = {
        title: translationService.translateText(
          'notifications.transaction.completion',
          'title',
          'en'
        ),
        message: `${translationService.translateText(
          'notifications.transaction.completion',
          'message',
          'en',
          { credits: CREDITS_AD_AWARD }
        )}`,
        data: notificationData,
        category: 'transactions',
        redirectTo: '/transactions',
      };
      console.log('Notification Saved in DB', notification);
      const user = await User.findById(userId);
      if (!user) throw new AppError('no user found', 404);
      await notificationService.saveNotificationToUser(user, notification);

      const translatedNotification: INotification = {
        ...notification,
        title: translationService.translateText(
          'notifications.transaction.completion',
          'title',
          user.preferredLanguage || 'en'
        ),
        message: translationService.translateText(
          'notifications.transaction.completion',
          'message',
          user.preferredLanguage || 'en',
          { credits: CREDITS_AD_AWARD }
        ),
      };
      await notificationService.sendPushNotificationToUser(
        userId,
        translatedNotification
      );
      res.status(200).json({
        message: `Successfully rewarded ${CREDITS_AD_AWARD} credit`,
        data: {
          totalUserCredits: userCredits,
        },
      });
    }
  ),
};
export default paymentController;
