// @io-wall-ok — tools composition root.
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import type { SecretStore } from '@pkgs/secret-store';

import { BILLING_API_ORIGIN_SECRET } from '../src/shared/secret-names';

/**
 * The origin `provision` seeds into `API_URL` when the environment has none.
 * `API_URL` is a registry secret with `optional: true` and this exact seed, so
 * deriving it here is not a guess — it is the same value, computed the same
 * way, one step earlier.
 */
function seededApiOrigin(): string {
  return `https://api.${PRODUCT_CONFIG.domain}`;
}

/**
 * Absolute URL the provider must POST subscription callbacks to.
 *
 * Falls back to {@link seededApiOrigin} when nothing is stored yet. Requiring
 * the stored secret made a PR gate depend on deploy ordering: `API_URL` is
 * written by `provision`, `provision` only runs in `//#deploy`, so any
 * environment that had never completed a deploy failed `billing:check` on
 * every pull request — for a value the registry can already compute.
 */
export async function readOfferCallbackUrl(
  store: SecretStore
): Promise<string> {
  const raw = (await store.getOptional(BILLING_API_ORIGIN_SECRET))
    ?.readSecretValue()
    ?.trim();
  const origin =
    typeof raw === 'string' && raw.length > 0 ? raw : seededApiOrigin();
  return `${origin.replace(/\/$/, '')}${PLUS_MEMBERSHIP_OFFER.callbackPath}`;
}
