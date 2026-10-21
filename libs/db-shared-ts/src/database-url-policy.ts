import { assertNonProdDatabaseUrl as assertNonProdDatabaseUrlWith } from '@pkgs/database-url-policy-shared-ts/database-url-policy';

import { PRODUCT_CONFIG } from './product-config';

/**
 * {@link assertNonProdDatabaseUrlWith} with this product's production-only
 * hostnames. Callers that must never reach production run it whenever their
 * environment is not production.
 */
export async function assertNonProdDatabaseUrl(
  url: string,
  context: Record<string, unknown> = {},
  options?: { readonly productionUrls?: readonly string[] }
): Promise<void> {
  await assertNonProdDatabaseUrlWith(url, context, {
    ...options,
    productionHostnames: PRODUCT_CONFIG.postgres.productionHostnames,
  });
}
