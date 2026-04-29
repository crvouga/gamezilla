import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchDbApiConfig } from '@gamezilla/patch-db/api';
import type { StripeRequireAuth } from '@gamezilla/stripe/stripe-checkout-route';
import type Stripe from 'stripe';

export type ApiHandlerConfig = PatchDbApiConfig & {
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly entityDb: EntityDb;
  readonly requireAuth: StripeRequireAuth;
  /** Doppler secret name for Stripe webhook signing secret. */
  readonly webhookSecretDopplerKey: string;
};
