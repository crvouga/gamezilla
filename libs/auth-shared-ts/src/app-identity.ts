/**
 * The product's identity as auth sees it, read from
 * `@libs/product-identity-shared-ts` (docs/BRANDING.md). Nothing here is
 * spelled by hand: a rebrand changes `displayName`, `domain` and `apiHost`;
 * `slug` (the technical namespace) and `urlScheme` (the registered deep-link
 * scheme) stay as they are, so stored sessions and deep links keep working.
 */
import {
  apiHost,
  brandHost,
} from '@libs/product-identity-shared-ts/brand-hosts';
import {
  NAMESPACE,
  PRODUCT,
  PRODUCT_NAME,
} from '@libs/product-identity-shared-ts/product-identity';

export const APP_IDENTITY = {
  /** Human-facing product name (titles, auth app name fallback). */
  displayName: PRODUCT_NAME,
  /** Immutable technical namespace (secure-storage prefix). */
  slug: NAMESPACE,
  /** Mobile deep-link scheme (`scheme://`). */
  urlScheme: PRODUCT.external.deepLinkScheme,
  /** Root domain for deployed surfaces. */
  domain: brandHost(),
  /** Production API Worker hostname (`https://api.…`). */
  apiHost: apiHost(),
} as const;
