import type {
  Billing,
  BillingCustomer,
  BillingEvent,
  CatalogSpec,
  CatalogSyncResult,
  CheckoutSession,
  CreateCheckoutSessionInput,
  CreateCustomerInput,
  CreatePortalSessionInput,
  PortalSession,
  VerifyWebhookInput,
} from '@pkgs/billing';
import type { SecretStore } from '@pkgs/secret-store';
import Stripe from 'stripe';
import { reconcileStripeCatalog } from './catalog-sync';
import { StripeSecretKeys } from './secret-keys';
import { translateStripeEvent } from './translate-event';

export class StripeBilling implements Billing {
  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string | null = null,
    private readonly now: () => number = () => 0
  ) {}

  async createCustomer(input: CreateCustomerInput): Promise<BillingCustomer> {
    const customer = await this.stripe.customers.create({
      metadata: { accountId: input.accountId },
      ...(input.email !== undefined ? { email: input.email } : {}),
    });
    return { customerId: customer.id };
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSession> {
    const prices = await this.stripe.prices.list({
      lookup_keys: [input.priceKey],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (price === undefined) {
      throw new Error(
        `stripe: no active price for lookup key ${input.priceKey}`
      );
    }
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: input.customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    return { id: session.id, url: session.url ?? '' };
  }

  async createPortalSession(
    input: CreatePortalSessionInput
  ): Promise<PortalSession> {
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return {
      id: portal.id,
      url: portal.url ?? '',
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<BillingEvent> {
    if (this.webhookSecret === null) {
      throw new Error('stripe: webhook secret is not configured');
    }
    const event = await this.stripe.webhooks.constructEventAsync(
      input.rawBody,
      input.signature,
      this.webhookSecret
    );
    return translateStripeEvent(event);
  }

  async syncCatalog(spec: CatalogSpec): Promise<CatalogSyncResult> {
    return reconcileStripeCatalog(this.stripe, spec, this.now);
  }
}

export function createStripeBilling(
  secretKey: string,
  webhookSecret: string | null = null,
  now: () => number = () => 0
): StripeBilling {
  return new StripeBilling(
    new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    }),
    webhookSecret,
    now
  );
}

/**
 * Build StripeBilling from a secret store, or null when the secret is missing.
 * The webhook signing secret is optional: without it webhook verification fails
 * closed while checkout/portal keep working.
 */
export async function createStripeBillingFromSecretStore(
  secretStore: SecretStore,
  now: () => number = () => 0
): Promise<StripeBilling | null> {
  const raw = (
    await secretStore.getOptional(StripeSecretKeys.secretKey)
  )?.readSecretValue();
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) return null;
  const webhookRaw = (
    await secretStore.getOptional(StripeSecretKeys.webhookSecret)
  )?.readSecretValue();
  const webhookTrimmed =
    typeof webhookRaw === 'string' ? webhookRaw.trim() : '';
  return createStripeBilling(
    trimmed,
    webhookTrimmed.length > 0 ? webhookTrimmed : null,
    now
  );
}
