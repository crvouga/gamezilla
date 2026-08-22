#!/usr/bin/env bun
// @io-wall-ok
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';
import { ensureObjectStoreBuckets } from '../src/provision-buckets';

function ok(label: string, detail?: string): void {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

if (!isProductionSecretsEnv()) {
  console.log('[object-store:provision] dry-run (SECRETS_ENV is not prd)');
  process.exit(0);
}

await ensureObjectStoreBuckets();
ok('B2 buckets', 'ensured (dev + prd)');
