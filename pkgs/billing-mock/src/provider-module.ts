/**
 * The mock provider as a membership provider module — the same shape as
 * Stripe's and Paddle's, so the localhost stack runs the production worker
 * with the mock by configuration alone. Its bindings are set by whoever boots
 * a mock provider (the stack), never managed as deployment secrets, so it
 * registers none; and its catalog is handed to it at boot
 * (`mockBillingCatalogFromOffer`), so it has no `reconcile`.
 */
import type { MembershipProviderModule } from '@pkgs/billing';

import { MockMembershipBilling } from './mock-membership-billing';
import { MOCK_BILLING_PROVIDER } from './wire';

/** Where the mock provider runs and its secrets: all three, or none. */
export const MockBillingBindingKeys = {
  origin: 'BILLING_MOCK_ORIGIN',
  secretKey: 'BILLING_MOCK_SECRET_KEY',
  webhookSecret: 'BILLING_MOCK_WEBHOOK_SECRET',
} as const;

export const MOCK_MEMBERSHIP_PROVIDER: MembershipProviderModule = {
  provider: MOCK_BILLING_PROVIDER,
  secrets: [],

  async create(env) {
    const origin = await env.readSecret(MockBillingBindingKeys.origin);
    const secretKey = await env.readSecret(MockBillingBindingKeys.secretKey);
    const webhookSecret = await env.readSecret(
      MockBillingBindingKeys.webhookSecret
    );
    if (origin === null && secretKey === null && webhookSecret === null) {
      return null;
    }
    // The mock is reached like any provider — an origin, a secret key, a
    // webhook signing secret — so a partial set is a misconfiguration.
    if (origin === null || secretKey === null || webhookSecret === null) {
      throw new Error(
        `the mock billing provider needs ${Object.values(MockBillingBindingKeys).join(', ')}`
      );
    }
    return new MockMembershipBilling({
      origin,
      secretKey,
      webhookSecret,
      offer: env.offer,
      now: env.now,
      fetch: env.fetch,
    });
  },
};
