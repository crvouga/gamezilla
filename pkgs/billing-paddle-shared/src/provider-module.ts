/**
 * Paddle as a membership provider module: the one thing composition roots
 * import from this package. They build, reconcile and register it exactly as
 * they do every other provider.
 */
import type {
  MembershipProviderEnv,
  MembershipProviderModule,
} from '@pkgs/billing-shared/provider-module';

import { reconcilePaddleOffer } from './offer-reconcile';
import { PaddleApi, paddleOriginForApiKey } from './paddle-api';
import { PADDLE_PROVIDER, PaddleMembershipBilling } from './paddle-membership';
import { billingPaddleSecretDefs } from './secret-defs';
import { PaddleSecretKeys } from './secret-keys';

async function apiKeyOf(env: MembershipProviderEnv): Promise<string | null> {
  return await env.readSecret(PaddleSecretKeys.apiKey);
}

export const PADDLE_MEMBERSHIP_PROVIDER: MembershipProviderModule = {
  provider: PADDLE_PROVIDER,
  secrets: billingPaddleSecretDefs,

  /**
   * `null` without `PADDLE_API_KEY`. The webhook secret and the hosted
   * checkout link are optional: without the first callbacks fail closed.
   */
  async create(env) {
    const apiKey = await apiKeyOf(env);
    if (apiKey === null) return null;
    return new PaddleMembershipBilling({
      apiKey,
      webhookSecret: await env.readSecret(PaddleSecretKeys.webhookSecret),
      checkoutUrl: await env.readSecret(PaddleSecretKeys.checkoutUrl),
      offer: env.offer,
      now: env.now,
      fetch: env.fetch,
    });
  },

  async reconcile(env) {
    const apiKey = await apiKeyOf(env);
    if (apiKey === null) return null;
    const result = await reconcilePaddleOffer(
      new PaddleApi({
        apiKey,
        origin: paddleOriginForApiKey(apiKey),
        fetch: env.fetch,
      }),
      env.offer,
      { callbackUrl: env.callbackUrl },
      env.log
    );
    if (result.newWebhookSecret !== null) {
      // Never logged: this runs in deploy logs. Paddle shows it in the
      // dashboard (Developer tools → Notifications).
      env.log.warn(
        `paddle: created notification destination ${result.notificationSettingId}; store its secret key as ${PaddleSecretKeys.webhookSecret}`
      );
    }
    return {
      productId: result.productId,
      prices: result.prices.length,
      notificationSettingId: result.notificationSettingId,
      unpricedCurrencies: result.unpricedCurrencies,
    };
  },
};
