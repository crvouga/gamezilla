import type { CatalogSpec, CatalogSyncResult } from './catalog';

export type CreateCustomerInput = {
  readonly accountId: string;
  readonly email?: string;
};

export type BillingCustomer = {
  readonly customerId: string;
};

export type CreateCheckoutSessionInput = {
  readonly customerId: string;
  readonly priceKey: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
};

export type CheckoutSession = {
  readonly id: string;
  readonly url: string;
};

export type CreatePortalSessionInput = {
  readonly customerId: string;
  readonly returnUrl: string;
};

export type PortalSession = {
  readonly id: string;
  readonly url: string;
};

/** Provider-neutral subscription state carried by a webhook. */
export type SubscriptionChange = {
  readonly accountId: string | null;
  readonly providerSubscriptionId: string;
  readonly priceKey: string | null;
  readonly status: string;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

export type BillingEvent =
  | ({ readonly kind: 'subscription_changed' } & SubscriptionChange)
  | { readonly kind: 'ignored'; readonly type: string };

export type VerifyWebhookInput = {
  readonly rawBody: string;
  readonly signature: string;
};

/**
 * Application billing port. Vendor adapters implement this; sim uses
 * {@link InMemoryBilling}.
 */
export interface Billing {
  createCustomer(input: CreateCustomerInput): Promise<BillingCustomer>;

  createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSession>;

  createPortalSession(input: CreatePortalSessionInput): Promise<PortalSession>;

  /** Verifies the provider signature and translates the event. */
  verifyWebhook(input: VerifyWebhookInput): Promise<BillingEvent>;

  syncCatalog(spec: CatalogSpec): Promise<CatalogSyncResult>;
}
