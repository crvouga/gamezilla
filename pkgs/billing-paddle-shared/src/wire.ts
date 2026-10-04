/**
 * The slice of Paddle Billing's REST API (`Paddle-Version: 1`) the adapter
 * speaks, in Paddle's own field names. Only this package reads these shapes.
 */

export const PADDLE_LIVE_ORIGIN = 'https://api.paddle.com';
export const PADDLE_SANDBOX_ORIGIN = 'https://sandbox-api.paddle.com';
export const PADDLE_API_VERSION = '1';

/** Webhook signature header: `ts=<unix seconds>;h1=<hex HMAC-SHA256>`. */
export const PADDLE_SIGNATURE_HEADER = 'paddle-signature';

/** Paddle's recommended tolerance between `ts` and the receiver's clock. */
export const PADDLE_SIGNATURE_TOLERANCE_S = 5;

export type PaddleEnvelope<T> = {
  readonly data: T;
  readonly meta?: {
    readonly request_id?: string;
    readonly pagination?: {
      readonly has_more?: boolean;
      readonly next?: string | null;
    };
  };
};

export type PaddleErrorBody = {
  readonly error?: {
    readonly type?: string;
    readonly code?: string;
    readonly detail?: string;
  };
};

export type PaddleCustomData = Readonly<Record<string, unknown>> | null;

export type PaddleCustomer = {
  readonly id: string;
  readonly email: string;
  readonly custom_data: PaddleCustomData;
};

export type PaddlePrice = {
  readonly id: string;
  readonly product_id: string;
  readonly description: string;
  readonly name: string | null;
  readonly status: 'active' | 'archived';
  readonly billing_cycle: {
    readonly interval: 'day' | 'week' | 'month' | 'year';
    readonly frequency: number;
  } | null;
  readonly trial_period: {
    readonly interval: 'day' | 'week' | 'month' | 'year';
    readonly frequency: number;
  } | null;
  readonly unit_price: {
    readonly amount: string;
    readonly currency_code: string;
  };
  readonly unit_price_overrides: readonly {
    readonly country_codes: readonly string[];
    readonly unit_price: {
      readonly amount: string;
      readonly currency_code: string;
    };
  }[];
  readonly custom_data: PaddleCustomData;
};

export type PaddleProduct = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly tax_category: string;
  readonly status: 'active' | 'archived';
  readonly custom_data: PaddleCustomData;
};

export type PaddleTransaction = {
  readonly id: string;
  readonly checkout: { readonly url: string | null } | null;
};

export type PaddlePortalSession = {
  readonly id: string;
  readonly urls: {
    readonly general: { readonly overview: string };
  };
};

export type PaddleSubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'paused'
  | 'trialing';

export type PaddleSubscription = {
  readonly id: string;
  readonly status: string;
  readonly customer_id: string;
  readonly custom_data: PaddleCustomData;
  /** RFC 3339; `null` while paused or once canceled. */
  readonly current_billing_period: {
    readonly starts_at: string;
    readonly ends_at: string;
  } | null;
  readonly scheduled_change: {
    readonly action: 'cancel' | 'pause' | 'resume';
    readonly effective_at: string;
    readonly resume_at: string | null;
  } | null;
  readonly canceled_at: string | null;
  readonly paused_at: string | null;
  readonly items: readonly {
    readonly status: string;
    readonly price: PaddlePrice;
  }[];
};

export type PaddleNotificationSetting = {
  readonly id: string;
  readonly description: string;
  readonly type: 'url' | 'email';
  readonly destination: string;
  readonly active: boolean;
  /** Names on create; objects (`{ name }`) when Paddle lists them back. */
  readonly subscribed_events: readonly (string | { readonly name: string })[];
  /** Returned when the destination is created: the webhook signing secret. */
  readonly endpoint_secret_key?: string;
};

/** Webhook payload envelope. */
export type PaddleEvent = {
  readonly event_id: string;
  readonly event_type: string;
  readonly occurred_at: string;
  readonly notification_id?: string;
  readonly data: { readonly id?: unknown } & Readonly<Record<string, unknown>>;
};

/** Custom-data keys this package writes onto Paddle entities. */
export const PADDLE_CUSTOM_DATA = {
  /** On a product: `offer.product.catalogProductId`. */
  catalogProductId: 'catalog_product_id',
  /** On a price: the offer price's `catalogPriceId`. */
  catalogPriceId: 'catalog_price_id',
  /** On a customer and a transaction (and so the subscription): our account. */
  accountId: 'account_id',
} as const;
