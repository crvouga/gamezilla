import type {
  Billing,
  CatalogSpec,
  CatalogSyncResult,
  CreatePortalSessionInput,
  PortalSession,
} from '@pkgs/billing';
import type { SecretStore } from '@pkgs/secret-store';
import Stripe from 'stripe';
import { reconcileStripeCatalog } from './catalog-sync';
import { StripeSecretKeys } from './secret-keys';

export class StripeBilling implements Billing {
  constructor(private readonly stripe: Stripe) {}

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

  async syncCatalog(spec: CatalogSpec): Promise<CatalogSyncResult> {
    return reconcileStripeCatalog(this.stripe, spec);
  }
}

export function createStripeBilling(secretKey: string): StripeBilling {
  return new StripeBilling(
    new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    })
  );
}

/**
 * Build StripeBilling from a secret store, or null when the secret is missing.
 */
export async function createStripeBillingFromSecretStore(
  secretStore: SecretStore
): Promise<StripeBilling | null> {
  const raw = (
    await secretStore.getOptional(StripeSecretKeys.secretKey)
  )?.readSecretValue();
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) return null;
  return createStripeBilling(trimmed);
}
