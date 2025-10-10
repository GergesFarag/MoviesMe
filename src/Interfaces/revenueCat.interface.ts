export interface RevenueCatConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface NonSubscriptionPurchase {
  display_name: string;
  id: string;
  is_sandbox: boolean;
  original_purchase_date: string;
  price: {
    amount: number;
    currency: string;
  };
  purchase_date: string;
  store: string;
  store_transaction_id: string;
}

interface Entitlement {
  expires_date: string | null;
  grace_period_expires_date: string | null;
  product_identifier: string;
  purchase_date: string;
}

export interface Subscriber {
  entitlements: Record<string, Entitlement>;
  first_seen: string;
  last_seen: string;
  management_url: string | null;
  non_subscriptions: Record<string, NonSubscriptionPurchase[]>;
  original_app_user_id: string;
  original_application_version: string | null;
  original_purchase_date: string | null;
  other_purchases: Record<string, any>;
  subscriptions: Record<string, any>;
}

export interface SubscriberResponse {
  request_date: string;
  request_date_ms: number;
  subscriber: Subscriber;
}
