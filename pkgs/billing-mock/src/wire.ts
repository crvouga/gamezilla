/**
 * The mock provider's wire: its REST paths, object shapes, event names and
 * error envelope. The adapter speaks it to the provider, and the provider
 * (`@pkgs/billing-mock-provider`) serves it.
 *
 * It follows Stripe closely on purpose: same object model (customer, price,
 * subscription, invoice, checkout and portal sessions, events), same
 * subscription statuses, same seconds-since-epoch timestamps, same
 * `{ error: { type, code, message } }` envelope, same magic test payment
 * methods, same list envelope with cursor pagination, same `Idempotency-Key`
 * and `expand[]` request semantics. Requests may be JSON or Stripe's
 * form encoding; the ids, host and signature header are the mock's own — it
 * never passes for Stripe.
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
  /** Resume a paused subscription (Stripe's `/resume`). */
  subscriptionResume: (id: string) => `/v1/subscriptions/${id}/resume`,
  checkoutSession: (id: string) => `/v1/checkout/sessions/${id}`,
  /** Expire an open checkout session now (Stripe's `/expire`). */
  checkoutSessionExpire: (id: string) => `/v1/checkout/sessions/${id}/expire`,
  invoices: '/v1/invoices',
  invoicePay: (id: string) => `/v1/invoices/${id}/pay`,
  /** Refund a paid invoice in full (the mock has no separate charges). */
  refunds: '/v1/refunds',
  events: '/v1/events',
  /** Test helper: move one customer's clock forward (Stripe's test clocks). */
  advanceCustomerClock: (id: string) =>
    `/v1/test_helpers/customers/${id}/advance_clock`,
  /**
   * Test helper: the card passes its expiry date (its expiry moves to the
   * month before the customer's clock), as a card on file does in time.
   */
  expirePaymentMethod: (id: string) =>
    `/v1/test_helpers/payment_methods/${id}/expire`,
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
  /**
   * 4000 0027 6000 3184 — every charge needs 3D Secure: one the customer is
   * present for (checkout, the portal) authenticates; an off-session renewal
   * fails with `authentication_required`.
   */
  authenticationRequired: 'pm_card_authenticationRequired',
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
  /**
   * Minor units applied to the next invoice: negative is credit the customer
   * holds (e.g. unused time from a downgrade), as on Stripe.
   */
  readonly balance: number;
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

/** What happens when a trial ends and the customer has no card on file. */
export type MockMissingPaymentMethodBehavior =
  | 'cancel'
  | 'pause'
  | 'create_invoice';

export type MockTrialSettings = {
  readonly end_behavior: {
    readonly missing_payment_method: MockMissingPaymentMethodBehavior;
  };
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
  readonly trial_settings: MockTrialSettings;
  readonly start_date: number;
  readonly created: number;
  readonly livemode: false;
  /** An invoice id, or the invoice itself when expanded. */
  readonly latest_invoice: string | MockInvoice | null;
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
  /**
   * How much of `amount_paid` went back to the customer. The mock has no
   * charge objects, so a refund is recorded on the invoice it pays back
   * (Stripe records it on the invoice's charge).
   */
  readonly amount_refunded: number;
  /** Before `starting_balance`: the sum of the lines. */
  readonly subtotal: number;
  readonly total: number;
  /** The customer's balance before (negative is credit) and after this invoice. */
  readonly starting_balance: number;
  readonly ending_balance: number;
  /** `<customer prefix>-<0001>`, assigned when the invoice is finalized. */
  readonly number: string | null;
  readonly attempted: boolean;
  readonly attempt_count: number;
  /** When the next automatic retry runs (unix seconds), or `null`. */
  readonly next_payment_attempt: number | null;
  readonly period_start: number;
  readonly period_end: number;
  readonly lines: MockList<MockInvoiceLine>;
  readonly created: number;
  readonly livemode: false;
};

export type MockInvoiceLine = {
  readonly id: string;
  readonly object: 'line_item';
  readonly description: string;
  /** Negative for a proration credit. */
  readonly amount: number;
  readonly price: string;
  readonly proration: boolean;
  readonly period: { readonly start: number; readonly end: number };
};

/** A refund of a paid invoice, in full. */
export type MockRefund = {
  readonly id: string;
  readonly object: 'refund';
  readonly amount: number;
  readonly currency: string;
  readonly customer: string;
  readonly invoice: string;
  readonly subscription: string;
  readonly status: 'succeeded';
  readonly created: number;
};

export type CreateRefundBody = {
  /** The paid invoice to refund. */
  readonly invoice: string;
};

export type MockCheckoutSession = {
  readonly id: string;
  readonly object: 'checkout.session';
  readonly mode: 'subscription';
  readonly status: 'open' | 'complete' | 'expired';
  readonly payment_status: 'unpaid' | 'paid' | 'no_payment_required';
  /** `if_required` lets a trial start without a card. */
  readonly payment_method_collection: 'always' | 'if_required';
  readonly amount_total: number;
  readonly currency: string;
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
    readonly trial_settings: MockTrialSettings;
  };
  /** A subscription id, or the subscription itself when expanded. */
  readonly subscription: string | MockSubscription | null;
  readonly livemode: false;
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
  | 'customer.updated'
  | 'payment_method.attached'
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.paused'
  | 'customer.subscription.resumed'
  | 'customer.subscription.trial_will_end'
  | 'invoice.created'
  | 'invoice.finalized'
  | 'invoice.paid'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'invoice.payment_action_required'
  | 'charge.refunded';

export type MockEventObject =
  | MockCustomer
  | MockPaymentMethod
  | MockCheckoutSession
  | MockSubscription
  | MockInvoice
  | MockRefund;

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
  | 'idempotency_error'
  | 'rate_limit_error'
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
  readonly payment_method_collection?: 'always' | 'if_required';
  readonly subscription_data?: {
    readonly metadata?: Readonly<Record<string, string>>;
    readonly trial_period_days?: number;
    readonly trial_settings?: MockTrialSettings;
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

/** Stripe's list cursor parameters, on every list endpoint. */
export type MockListParams = {
  /** 1–100, default 10. */
  readonly limit?: number;
  readonly starting_after?: string;
  readonly ending_before?: string;
};

/** Replays of a request with this header return the first response. */
export const MOCK_BILLING_IDEMPOTENCY_HEADER = 'idempotency-key';

/** Set on a response that was replayed from an earlier idempotent request. */
export const MOCK_BILLING_IDEMPOTENT_REPLAYED_HEADER = 'idempotent-replayed';

export type AdvanceClockBody = {
  /** Unix seconds; must not be behind the customer's clock. */
  readonly frozen_time: number;
};
