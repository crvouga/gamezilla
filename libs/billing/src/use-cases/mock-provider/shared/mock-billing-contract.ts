/**
 * The JSON contract between the mock provider's hosted pages (the Solid SPA)
 * and its Hono API. Paths are relative to the mock base
 * (`/api/billing/mock`), which the SPA derives from its own URL.
 */
import type { MembershipStatus } from '@pkgs/billing';

export const MOCK_BILLING_API = {
  state: 'api/state',
  checkout: 'api/checkout',
  portal: 'api/portal',
} as const;

/** Where the built SPA's files live, relative to the mock base. */
export const MOCK_BILLING_ASSETS = {
  js: 'assets/app.js',
  css: 'assets/app.css',
} as const;

export type MockBillingPrice = {
  readonly key: string;
  readonly interval: 'month' | 'year';
  /** Integer minor units. */
  readonly unitAmount: number;
  readonly currency: string;
  readonly trialPeriodDays: number;
};

export type MockBillingMembership = {
  readonly status: MembershipStatus;
  readonly priceKey: string | null;
  readonly periodEndMs: number | null;
  readonly endsAtPeriodEnd: boolean;
};

export type MockBillingState = {
  readonly brand: string;
  readonly product: {
    readonly name: string;
    readonly description: string;
  };
  /** Switchable prices, in the offer's order. */
  readonly prices: readonly MockBillingPrice[];
  readonly defaultPriceKey: string;
  readonly membership: MockBillingMembership | null;
  /** The server clock, so the page never reads a wall clock of its own. */
  readonly nowMs: number;
};

export type MockCheckoutBody = {
  readonly accountId: string;
  readonly priceKey: string;
};

export type MockPortalAction =
  | { readonly kind: 'cancel' }
  | { readonly kind: 'resume' }
  | { readonly kind: 'switch'; readonly priceKey: string };

export type MockPortalBody = {
  readonly accountId: string;
  readonly action: MockPortalAction;
};
