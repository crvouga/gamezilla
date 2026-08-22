import {
  assertDatabaseUrlAllowedForSecretsEnvForTooling as assertToolingAllowed,
  assertNonProdDatabaseUrlForTooling as assertToolingNonProd,
} from '@pkgs/database-url-policy/database-url-policy-tooling';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { join } from 'node:path';

import { PRODUCT_CONFIG } from '../shared/product-config';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

const toolingDeps = {
  repoRoot: REPO_ROOT,
  fetchFn: (input: RequestInfo | URL, init?: RequestInit) =>
    createGlobalHttpClient().fetch(input, init),
};

const policyOptions = {
  productionHostnames: PRODUCT_CONFIG.postgres.productionHostnames,
} as const;

export async function assertNonProdDatabaseUrlForTooling(
  url: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  await assertToolingNonProd(url, toolingDeps, context, policyOptions);
}

export async function assertDatabaseUrlAllowedForSecretsEnvForTooling(
  url: string,
  secretsEnv: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  await assertToolingAllowed(url, secretsEnv, toolingDeps, context, policyOptions);
}
