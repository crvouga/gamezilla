/**
 * The JSON contract between the provider's hosted pages (the Solid SPA) and
 * the provider. A page is authorized by its session id alone, like a real
 * provider's hosted link: whoever holds `/c/pay/<id>` or `/p/session/<id>` may
 * act on that one customer, and nothing else.
 *
 * Times are epoch milliseconds on the customer's test clock (`nowMs`), so a
 * page never reads a wall clock of its own. Money is integer minor units.
 */
import {
  MOCK_TEST_PAYMENT_METHODS,
  type MockCard,
  type MockInvoiceStatus,
  type MockSubscriptionStatus,
  type MockTestPaymentMethod,
} from '@pkgs/billing-mock/wire';

export const MOCK_BILLING_PAGE_API = {
  checkout: (sessionId: string) => `/pages/api/checkout/${sessionId}`,
  checkoutConfirm: (sessionId: string) =>
    `/pages/api/checkout/${sessionId}/confirm`,
  portal: (sessionId: string) => `/pages/api/portal/${sessionId}`,
  portalAction: (sessionId: string) => `/pages/api/portal/${sessionId}/actions`,
} as const;

/** Where the built SPA lives on the provider's origin. */
export const MOCK_BILLING_ASSETS = {
  js: '/assets/app.js',
  css: '/assets/app.css',
  favicon: '/favicon.svg',
} as const;

export type PagePrice = {
  readonly id: string;
  readonly lookupKey: string | null;
  readonly nickname: string | null;
  readonly interval: 'month' | 'year';
  readonly unitAmount: number;
  readonly currency: string;
};

/** A card a tester can pay with, and what it will do. */
export type PageTestCard = {
  readonly paymentMethod: MockTestPaymentMethod;
  readonly brand: MockCard['brand'];
  readonly number: string;
  readonly label: string;
  readonly outcome: string;
};

export const PAGE_TEST_CARDS: readonly PageTestCard[] = [
  {
    paymentMethod: MOCK_TEST_PAYMENT_METHODS.visa,
    brand: 'visa',
    number: '4242 4242 4242 4242',
    label: 'Visa',
    outcome: 'Succeeds',
  },
  {
    paymentMethod: MOCK_TEST_PAYMENT_METHODS.mastercard,
    brand: 'mastercard',
    number: '5555 5555 5555 4444',
    label: 'Mastercard',
    outcome: 'Succeeds',
  },
  {
    paymentMethod: MOCK_TEST_PAYMENT_METHODS.chargeCustomerFail,
    brand: 'visa',
    number: '4000 0000 0000 0341',
    label: 'Visa · fails later',
    outcome: 'Attaches, then every charge is declined',
  },
  {
    paymentMethod: MOCK_TEST_PAYMENT_METHODS.chargeDeclined,
    brand: 'visa',
    number: '4000 0000 0000 0002',
    label: 'Visa · declined',
    outcome: 'Declined straight away',
  },
];

export type PageBusiness = {
  readonly name: string;
  readonly product: { readonly name: string; readonly description: string };
};

export type CheckoutView = {
  readonly business: PageBusiness;
  readonly session: {
    readonly id: string;
    readonly status: 'open' | 'complete' | 'expired';
    readonly successUrl: string;
    readonly cancelUrl: string;
    /** The trial the session grants, or `null` for none. */
    readonly trialPeriodDays: number | null;
  };
  /** The session's price first, then the prices it may be switched to. */
  readonly prices: readonly PagePrice[];
  readonly selectedPriceId: string;
  readonly nowMs: number;
};

export type CheckoutConfirmBody = {
  readonly price: string;
  readonly paymentMethod: MockTestPaymentMethod;
};

export type CheckoutConfirmResult = { readonly redirectUrl: string };

export type PortalSubscription = {
  readonly id: string;
  readonly status: MockSubscriptionStatus;
  readonly priceId: string;
  readonly currentPeriodEndMs: number;
  readonly cancelAtPeriodEnd: boolean;
  readonly trialEndMs: number | null;
  readonly endedAtMs: number | null;
  /** The unpaid invoice a past-due subscription is waiting on. */
  readonly openInvoice: {
    readonly id: string;
    readonly amountDue: number;
    readonly currency: string;
    readonly nextAttemptMs: number | null;
  } | null;
};

export type PortalInvoice = {
  readonly id: string;
  readonly createdMs: number;
  readonly status: MockInvoiceStatus;
  readonly amountDue: number;
  readonly amountPaid: number;
  readonly currency: string;
  readonly description: string;
};

export type PortalView = {
  readonly business: PageBusiness;
  readonly returnUrl: string;
  /** The prices the portal lets a customer switch between. */
  readonly prices: readonly PagePrice[];
  /** The customer's live subscription, else their most recent one. */
  readonly subscription: PortalSubscription | null;
  readonly paymentMethod: MockCard | null;
  /** Newest first. */
  readonly invoices: readonly PortalInvoice[];
  readonly cancellationReasons: readonly string[];
  readonly nowMs: number;
};

export type PortalAction =
  | { readonly kind: 'cancel'; readonly reason: string | null }
  | { readonly kind: 'renew' }
  | { readonly kind: 'switch'; readonly price: string }
  | {
      readonly kind: 'update_payment_method';
      readonly paymentMethod: MockTestPaymentMethod;
    };
