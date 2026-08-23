import {
  assertDatabaseUrlAllowedForSecretsEnv,
  assertDevSecretsEnv,
  assertNonProdDatabaseUrl,
  DEVELOPMENT_SECRETS_ENV,
  normalizeDatabaseUrlForCompare,
  PRODUCTION_SECRETS_ENV,
  productionDatabaseUrlTigerExceptionEnabled,
} from '@pkgs/database-url-policy';

import { PRODUCT_CONFIG } from '../shared/product-config';

const policyOptions = {
  productionHostnames: PRODUCT_CONFIG.postgres.productionHostnames,
} as const;

export {
  assertDevSecretsEnv,
  DEVELOPMENT_SECRETS_ENV,
  normalizeDatabaseUrlForCompare,
  PRODUCTION_SECRETS_ENV,
  productionDatabaseUrlTigerExceptionEnabled,
};

export async function assertNonProdDatabaseUrlForProduct(
  url: string,
  context: Record<string, unknown> = {},
  options?: { readonly productionUrl?: string | null }
): Promise<void> {
  await assertNonProdDatabaseUrl(url, context, {
    ...options,
    productionHostnames: policyOptions.productionHostnames,
  });
}

export async function assertDatabaseUrlAllowedForSecretsEnvForProduct(
  url: string,
  secretsEnv: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  await assertDatabaseUrlAllowedForSecretsEnv(
    url,
    secretsEnv,
    context,
    policyOptions
  );
}

// Re-export with product naming used by callers
export {
  assertDatabaseUrlAllowedForSecretsEnvForProduct as assertDatabaseUrlAllowedForSecretsEnv,
  assertNonProdDatabaseUrlForProduct as assertNonProdDatabaseUrl,
};
