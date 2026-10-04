import { join } from 'node:path';
import { assertNonProdDatabaseUrlForTooling as assertToolingNonProd } from '@pkgs/database-url-policy-server/database-url-policy-tooling';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';

import { PRODUCT_CONFIG } from '@libs/db-shared/product-config';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

const policyOptions = {
  productionHostnames: PRODUCT_CONFIG.postgres.productionHostnames,
} as const;

/**
 * Tiger guard for tooling: `url` is not production, compared against the
 * `DATABASE_URL` of every environment in `productionEnvs` (the caller reads
 * which environments are production from their env files).
 */
export async function assertNonProdDatabaseUrlForTooling(
  url: string,
  productionEnvs: readonly string[],
  context: Record<string, unknown> = {}
): Promise<void> {
  await assertToolingNonProd(
    url,
    {
      repoRoot: REPO_ROOT,
      fetchFn: (input, init) => createGlobalHttpClient().fetch(input, init),
      productionEnvs,
    },
    context,
    policyOptions
  );
}
