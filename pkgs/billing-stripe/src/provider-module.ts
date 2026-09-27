/**
 * Stripe as a membership provider module: the one thing composition roots
 * import from this package. They build, reconcile and register it exactly as
 * they do every other provider.
 */
import type { MembershipProviderModule } from '@pkgs/billing';

import { reconcileStripeOffer } from './offer-reconcile';
import { billingStripeSecretDefs } from './secret-defs';
import { StripeSecretKeys } from './secret-keys';
import {
  createStripeClient,
  createStripeMembershipBilling,
  STRIPE_PROVIDER,
} from './stripe-membership';

export const STRIPE_MEMBERSHIP_PROVIDER: MembershipProviderModule = {
  provider: STRIPE_PROVIDER,
  secrets: billingStripeSecretDefs,

  /**
   * `null` without `STRIPE_SECRET_KEY`. The webhook signing secret is
   * optional: without it callbacks fail closed while checkout and the portal
   * keep working.
   */
  async create(env) {
    const secretKey = await env.readSecret(StripeSecretKeys.secretKey);
    if (secretKey === null) return null;
    return createStripeMembershipBilling({
      secretKey,
      webhookSecret: await env.readSecret(StripeSecretKeys.webhookSecret),
      offer: env.offer,
      now: env.now,
      transport: { fetch: env.fetch },
    });
  },

  async reconcile(env) {
    const secretKey = await env.readSecret(StripeSecretKeys.secretKey);
    if (secretKey === null) return null;
    const result = await reconcileStripeOffer(
      createStripeClient(secretKey, { fetch: env.fetch }),
      env.offer,
      { callbackUrl: env.callbackUrl },
      env.log
    );
    return {
      products: result.products.length,
      prices: result.prices.length,
      portalConfigurationId: result.portalConfigurationId,
      webhookEndpointId: result.webhookEndpointId,
    };
  },
};
