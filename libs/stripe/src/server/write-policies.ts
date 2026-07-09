import type {
  WritePolicy,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';
import { ENTITY_STORE_TABLE } from '@pkgs/sync-engine/shared/entity-store';

/** Stripe rows live in entity_store with namespace `stripe` (system-only). */
export const stripeEntityStoreWritePolicy: WritePolicy = () => ({
  allowed: false,
  reason: 'stripe entity_store is system-only',
});

export const STRIPE_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> = {
  [ENTITY_STORE_TABLE]: stripeEntityStoreWritePolicy,
};

export function createStripeWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(STRIPE_WRITE_POLICIES);
}
