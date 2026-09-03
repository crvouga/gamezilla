#!/usr/bin/env bun
// @io-wall-ok
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '../../../../tools/src/deploy-mode';
import { ensureObjectStoreBuckets } from '../shared/ensure-buckets';

const log = createLogger({
  name: 'object-store:provision',
  now: wallClock.now,
});

function ok(label: string, detail?: string): void {
  log.info(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

if (!isProductionSecretsEnv()) {
  log.info('[object-store:provision] dry-run (SECRETS_ENV is not prd)');
  process.exit(0);
}

await ensureObjectStoreBuckets();
ok('B2 buckets', 'ensured (dev + prd)');
