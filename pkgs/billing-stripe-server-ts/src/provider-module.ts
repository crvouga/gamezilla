/**
 * Stripe as a membership provider module: the one thing composition roots
 * import from this package. They build, reconcile and register it exactly as
 * they do every other provider.
 */
import type {
  MembershipProviderEnv,
  MembershipProviderModule,
} from '@pkgs/billing-root-shared-ts/provider-module';

import { reconcileStripeOffer } from '@pkgs/billing-stripe-shared-ts/offer-reconcile';
import { billingStripeSecretDefs } from '@pkgs/billing-stripe-shared-ts/secret-defs';
import {
  StripeBindingKeys,
  StripeSecretKeys,
} from '@pkgs/billing-stripe-shared-ts/secret-keys';
import type { StripeMembershipTransport } from './stripe-membership';
import {
  createStripeClient,
  createStripeMembershipBilling,
  STRIPE_PROVIDER,
} from './stripe-membership';

/** Stripe itself, or the simulated Stripe `STRIPE_API_ORIGIN` names. */
async function transportOf(
  env: Pick<MembershipProviderEnv, 'readSecret' | 'fetch'>
): Promise<StripeMembershipTransport> {
  const origin = await env.readSecret(StripeBindingKeys.apiOrigin);
  return origin === null ? { fetch: env.fetch } : { origin, fetch: env.fetch };
}

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
      transport: await transportOf(env),
    });
  },

  async reconcile(env) {
    const secretKey = await env.readSecret(StripeSecretKeys.secretKey);
    if (secretKey === null) return null;
    const result = await reconcileStripeOffer(
      createStripeClient(secretKey, await transportOf(env)),
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
