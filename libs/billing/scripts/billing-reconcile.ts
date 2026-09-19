// @io-wall-ok — tools composition root.
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import type { SecretStore } from '@pkgs/secret-store';

import { BILLING_API_ORIGIN_SECRET } from '../src/shared/secret-names';

/**
 * Absolute URL the provider must POST subscription callbacks to, or `null`
 * when the deployed API origin is not resolvable.
 */
export async function readOfferCallbackUrl(
  store: SecretStore
): Promise<string | null> {
  const raw = (await store.getOptional(BILLING_API_ORIGIN_SECRET))
    ?.readSecretValue()
    ?.trim();
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return `${raw.replace(/\/$/, '')}${PLUS_MEMBERSHIP_OFFER.callbackPath}`;
}
