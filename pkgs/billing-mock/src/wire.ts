/**
 * The mock provider's wire: its REST paths, object shapes, event names and
 * error envelope. The adapter speaks it to the provider, and the provider
 * (`@pkgs/billing-mock-provider`) serves it.
 *
 * It follows Stripe closely on purpose: same object model (customer, price,
 * subscription, invoice, checkout and portal sessions, events), same
 * subscription statuses, same seconds-since-epoch timestamps, same
 * `{ error: { type, code, message } }` envelope, same magic test payment
 * methods. The bodies are JSON rather than form-encoded, and the ids, host
 * and signature header are the mock's own — it never passes for Stripe.
 */

export const MOCK_BILLING_PROVIDER = 'mock';

/** Every request to `/v1/*` carries `Authorization: Bearer <secret key>`. */
export const MOCK_BILLING_SECRET_KEY_PREFIX = 'sk_test_mock_';

/** Webhook signature header: `t=<unix seconds>,v1=<hex HMAC-SHA256>`. */
export const MOCK_BILLING_SIGNATURE_HEADER = 'billing-mock-signature';

/** Signatures older (or newer) than this are rejected, like Stripe's default. */
export const MOCK_BILLING_SIGNATURE_TOLERANCE_S = 300;

export const MOCK_BILLING_PATHS = {
  customers: '/v1/customers',
  customer: (id: string) => `/v1/customers/${id}`,
  prices: '/v1/prices',
  checkoutSessions: '/v1/checkout/sessions',
  portalSessions: '/v1/billing_portal/sessions',
  subscription: (id: string) => `/v1/subscriptions/${id}`,
  subscriptions: '/v1/subscriptions',
  invoices: '/v1/invoices',
  invoicePay: (id: string) => `/v1/invoices/${id}/pay`,
  events: '/v1/events',
  /** Test helper: move one customer's clock forward (Stripe's test clocks). */
  advanceCustomerClock: (id: string) =>
    `/v1/test_helpers/customers/${id}/advance_clock`,
  /** Test helper: deliver an event again (Stripe's "resend"). */
  resendEvent: (id: string) => `/v1/test_helpers/events/${id}/resend`,
  /** Hosted pages: a checkout session and a portal session. */
  checkoutPage: (id: string) => `/c/pay/${id}`,
  portalPage: (id: string) => `/p/session/${id}`,
} as const;

export type MockSubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export type MockList<T> = {
  readonly object: 'list';
  readonly data: readonly T[];
  readonly has_more: boolean;
  readonly url: string;
};

export type MockPrice = {
  readonly id: string;
  readonly object: 'price';
  readonly active: boolean;
  readonly product: string;
  readonly lookup_key: string | null;
  readonly nickname: string | null;
  /** Integer minor units. */
  readonly unit_amount: number;
  readonly currency: string;
  readonly recurring: {
    readonly interval: 'month' | 'year';
    readonly interval_count: 1;
    /** Informational: Checkout applies a trial only when asked to. */
    readonly trial_period_days: number | null;
  };
  readonly created: number;
};

export type MockCard = {
  readonly brand: 'visa' | 'mastercard';
  readonly last4: string;
  readonly exp_month: number;
  readonly exp_year: number;
};

export type MockPaymentMethod = {
  readonly id: string;
  readonly object: 'payment_method';
  readonly type: 'card';
  readonly customer: string;
  readonly card: MockCard;
  readonly created: number;
};

/**
 * Magic test payment methods, named as Stripe names them. Attaching one mints
 * a real payment method on the customer with the card's behaviour.
 */
export const MOCK_TEST_PAYMENT_METHODS = {
  /** 4242 4242 4242 4242 — every charge succeeds. */
  visa: 'pm_card_visa',
  /** 5555 5555 5555 4444 — every charge succeeds. */
  mastercard: 'pm_card_mastercard',
  /** 4000 0000 0000 0341 — attaches, then every charge is declined. */
  chargeCustomerFail: 'pm_card_chargeCustomerFail',
  /** 4000 0000 0000 0002 — declined as soon as it is used. */
  chargeDeclined: 'pm_card_chargeDeclined',
} as const;

export type MockTestPaymentMethod =
  (typeof MOCK_TEST_PAYMENT_METHODS)[keyof typeof MOCK_TEST_PAYMENT_METHODS];

export type MockCustomer = {
  readonly id: string;
  readonly object: 'customer';
  readonly created: number;
  readonly email: string | null;
  readonly name: string | null;
  readonly metadata: Readonly<Record<string, string>>;
  readonly invoice_settings: {
    readonly default_payment_method: string | null;
  };
  /** The customer's test clock (unix seconds); billing runs on it. */
  readonly test_clock_frozen_time: number;
};

export type MockSubscriptionItem = {
  readonly id: string;
  readonly object: 'subscription_item';
  readonly price: MockPrice;
  readonly quantity: 1;
  readonly current_period_start: number;
  readonly current_period_end: number;
};

export type MockCancellationDetails = {
  readonly reason:
    | 'cancellation_requested'
    | 'payment_failed'
    | 'payment_disputed'
    | null;
  readonly feedback: string | null;
  readonly comment: string | null;
};

export type MockSubscription = {
  readonly id: string;
  readonly object: 'subscription';
  readonly customer: string;
  readonly status: MockSubscriptionStatus;
  readonly items: MockList<MockSubscriptionItem>;
  readonly cancel_at_period_end: boolean;
  readonly cancel_at: number | null;
  readonly canceled_at: number | null;
  readonly ended_at: number | null;
  readonly cancellation_details: MockCancellationDetails;
  readonly trial_start: number | null;
  readonly trial_end: number | null;
  readonly start_date: number;
  readonly created: number;
  readonly latest_invoice: string | null;
  readonly default_payment_method: string | null;
  readonly metadata: Readonly<Record<string, string>>;
};

export type MockInvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export type MockInvoice = {
  readonly id: string;
  readonly object: 'invoice';
  readonly customer: string;
  readonly subscription: string;
  readonly status: MockInvoiceStatus;
  readonly billing_reason:
    | 'subscription_create'
    | 'subscription_cycle'
    | 'subscription_update';
  readonly currency: string;
  readonly amount_due: number;
  readonly amount_paid: number;
  readonly amount_remaining: number;
  readonly attempt_count: number;
  /** When the next automatic retry runs (unix seconds), or `null`. */
  readonly next_payment_attempt: number | null;
  readonly period_start: number;
  readonly period_end: number;
  readonly lines: MockList<{
    readonly description: string;
    readonly amount: number;
    readonly price: string;
  }>;
  readonly created: number;
};

export type MockCheckoutSession = {
  readonly id: string;
  readonly object: 'checkout.session';
  readonly mode: 'subscription';
  readonly status: 'open' | 'complete' | 'expired';
  readonly url: string | null;
  readonly customer: string;
  readonly client_reference_id: string | null;
  readonly success_url: string;
  readonly cancel_url: string;
  readonly line_items: MockList<{
    readonly price: MockPrice;
    readonly quantity: 1;
  }>;
  readonly subscription_data: {
    readonly metadata: Readonly<Record<string, string>>;
    readonly trial_period_days: number | null;
  };
  readonly subscription: string | null;
  readonly expires_at: number;
  readonly created: number;
};

export type MockPortalSession = {
  readonly id: string;
  readonly object: 'billing_portal.session';
  readonly customer: string;
  readonly return_url: string;
  readonly url: string;
  readonly created: number;
  /** A portal link must be opened within minutes and lasts an hour. */
  readonly expires_at: number;
};

export type MockEventType =
  | 'customer.created'
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.payment_failed';

export type MockEventObject =
  | MockCustomer
  | MockCheckoutSession
  | MockSubscription
  | MockInvoice;

export type MockEvent = {
  readonly id: string;
  readonly object: 'event';
  readonly type: MockEventType;
  readonly created: number;
  readonly livemode: false;
  readonly api_version: string;
  readonly data: {
    readonly object: MockEventObject;
    readonly previous_attributes?: Readonly<Record<string, unknown>>;
  };
};

export const MOCK_BILLING_API_VERSION = '2026-09-01.mock';

export type MockErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'card_error'
  | 'api_error';

export type MockErrorBody = {
  readonly error: {
    readonly type: MockErrorType;
    readonly code?: string;
    readonly decline_code?: string;
    readonly param?: string;
    readonly message: string;
  };
};

export type CreateCustomerBody = {
  readonly email?: string;
  readonly name?: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type UpdateCustomerBody = {
  readonly invoice_settings?: { readonly default_payment_method?: string };
};

export type CreateCheckoutSessionBody = {
  readonly mode: 'subscription';
  readonly customer: string;
  readonly client_reference_id?: string;
  readonly line_items: readonly [
    { readonly price: string; readonly quantity: 1 },
  ];
  readonly success_url: string;
  readonly cancel_url: string;
  readonly subscription_data?: {
    readonly metadata?: Readonly<Record<string, string>>;
    readonly trial_period_days?: number;
  };
};

export type CreatePortalSessionBody = {
  readonly customer: string;
  readonly return_url: string;
};

export type UpdateSubscriptionBody = {
  readonly cancel_at_period_end?: boolean;
  readonly cancellation_details?: { readonly feedback?: string };
  /** Replace the one item's price (interval switch). */
  readonly items?: readonly [{ readonly id: string; readonly price: string }];
  readonly proration_behavior?: 'create_prorations' | 'always_invoice' | 'none';
};

export type AdvanceClockBody = {
  /** Unix seconds; must not be behind the customer's clock. */
  readonly frozen_time: number;
};
