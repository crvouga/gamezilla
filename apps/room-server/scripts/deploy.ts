#!/usr/bin/env bun
// @io-wall-ok
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';
import { ok } from '@libs/secrets/shared/fmt';
import { runAsync } from '@libs/secrets/shared/subprocess';
import { wranglerEnv, wranglerArgs } from '@libs/secrets/shared/wrangler-env';

const roomDir = join(import.meta.dirname, '..');

async function deploy(dryRun: boolean): Promise<void> {
  const args = dryRun
    ? wranglerArgs('deploy', '--dry-run')
    : wranglerArgs('deploy');
  const label = dryRun
    ? 'room-worker: Cloudflare Workers deploy (dry-run)'
    : 'room-worker: Cloudflare Workers deploy';

  await runAsync('wrangler', args, {
    cwd: roomDir,
    env: wranglerEnv(),
    label,
  });

  if (dryRun) {
    ok('room-worker dry-run', 'room durable object worker validated locally');
    return;
  }

  console.log(`Room Worker deployed (${PRODUCT_CONFIG.cloudflare.roomWorker}).`);
}

const dryRun = !isProductionSecretsEnv();
if (dryRun) {
  console.log('[room-server:deploy] dry-run (SECRETS_ENV is not prd)');
}
await deploy(dryRun);
