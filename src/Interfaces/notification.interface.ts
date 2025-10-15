import { TNotificationCategory } from "../types";

// Define all possible notification types
export type NotificationType = "story" | "effect" | "generation" | "transaction" | "promotion" | "system";

// Define all possible notification statuses
export type NotificationStatus = "completed" | "pending" | "failed";

// Base notification data that all types share
interface BaseNotificationData {
  type: NotificationType;
  status?: NotificationStatus;
  userId?: string;
  jobId?: string;
}

// Story-specific notification data
export interface StoryNotificationData extends BaseNotificationData {
  type: "story";
  storyId?: string;
  credits?: number;
  error?: string;
}

// Effect-specific notification data
export interface EffectNotificationData extends BaseNotificationData {
  type: "effect";
  effectId?: string;
  credits?: number;
  error?: string;
}

// Generation-specific notification data
export interface GenerationNotificationData extends BaseNotificationData {
  type: "generation";
  generationId?: string;
  credits?: number;
  error?: string;
  resultURL?: string;
}

// Transaction-specific notification data
export interface TransactionNotificationData extends BaseNotificationData {
  type: "transaction";
  transactionId?: string;
  amount?: number;
  userCredits?: number;
}

// Promotion-specific notification data
export interface PromotionNotificationData extends BaseNotificationData {
  type: "promotion";
  promotionId?: string;
  discountAmount?: number;
  expiresAt?: Date;
}

// System-specific notification data
export interface SystemNotificationData extends BaseNotificationData {
  type: "system";
  [key: string]: any;
}

export type NotificationData =
  | StoryNotificationData
  | EffectNotificationData
  | GenerationNotificationData
  | TransactionNotificationData
  | PromotionNotificationData
  | SystemNotificationData;

export interface INotification {
  title: string;
  message: string;
  redirectTo: string | null;
  data: NotificationData;
  category?: TNotificationCategory;
  createdAt?: Date;
  expiresAt?: Date;
  isRead?: boolean;
}