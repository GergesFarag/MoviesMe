import axios, { AxiosInstance } from "axios";
import AppError from "../Utils/Errors/AppError";
import {
  RevenueCatConfig,
  SubscriberResponse,
  PurchaseValidationResult,
  CreditPackage,
  NonSubscriptionPurchase,
} from "../Interfaces/revenueCat.interface";

export class PurchasingService {
  private client: AxiosInstance;
  constructor(config: RevenueCatConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl || "https://api.revenuecat.com/v1",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }
  async getUserSubscriptions(userId: string): Promise<{ [key: string]: NonSubscriptionPurchase[] }> {
    try {
      const response = await this.client.get(`/subscribers/${userId}`);
      const subscriber = response.data.subscriber;
      return subscriber ? subscriber.non_subscriptions : {};
    } catch (error) {
      throw new AppError("Failed to fetch user subscriptions", 500);
    }
  }

  async getAllSubscribers(): Promise<SubscriberResponse[]> {
    try {
      const response = await this.client.get(`/subscribers`);
      return response.data.subscribers;
    } catch (error) {
      if (error instanceof Error) {
        throw new AppError(error.message, 500);
      } else {
        throw new AppError("Failed to fetch subscribers", 500);
      }
    }
  }

  async validateSpecificPurchase(userAppId: string, transactionId: string): Promise<NonSubscriptionPurchase | null> {
    try {
      const non_subscriptions = await this.getUserSubscriptions(userAppId);
      
      if (!non_subscriptions) {
        return null;
      }

      for (const purchases of Object.values(non_subscriptions)) {
        const purchase = purchases.find((p: NonSubscriptionPurchase) => p.store_transaction_id === transactionId);
        if (purchase && this.isPurchaseValid(purchase)) {
          return purchase;
        }
      }

      return null;
    } catch (error) {
      throw new AppError("Failed to validate specific purchase", 500);
    }
  }

  private isPurchaseValid(purchase: NonSubscriptionPurchase): boolean {
    if (!purchase.store_transaction_id || purchase.store_transaction_id.trim() === '') {
      return false;
    }
    try {
      const purchaseDate = new Date(purchase.purchase_date);
      if (isNaN(purchaseDate.getTime())) {
        return false;
      }
    } catch {
      return false;
    }

    if (!purchase.price || purchase.price.amount <= 0) {
      return false;
    }
    return true;
  }

}
