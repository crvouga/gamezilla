#!/usr/bin/env bun
// @io-wall-ok
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { ok } from '@libs/secrets/shared/fmt';
import {
  activeSecretsEnv,
  loadSecretsIntoEnv,
} from '@libs/secrets/shared/secrets/secrets';
import { runAsync } from '@libs/secrets/shared/subprocess';
import { wranglerArgs, wranglerEnv } from '@libs/secrets/shared/wrangler-env';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';

const log = createLogger({ name: 'room-server:deploy', now: wallClock.now });

const roomDir = join(import.meta.dirname, '..');

async function pushRoomWorkerBindings(): Promise<void> {
  await loadSecretsIntoEnv();
  const payload: Record<string, string> = {
    SECRETS_ENV: activeSecretsEnv(),
  };
  for (const key of [
    'OBSERVABILITY_COLLECTOR_URL',
    'OBSERVABILITY_COLLECTOR_USER',
    'OBSERVABILITY_COLLECTOR_TOKEN',
  ] as const) {
    const value = process.env[key]?.trim() ?? '';
    if (value.length > 0) payload[key] = value;
  }
  const enabled = process.env['OBSERVABILITY_ENABLED']?.trim() ?? '';
  if (enabled.length > 0) payload['OBSERVABILITY_ENABLED'] = enabled;
  if (payload['SECRETS_ENV'] === 'prd' && enabled !== '0') {
    for (const required of [
      'OBSERVABILITY_COLLECTOR_URL',
      'OBSERVABILITY_COLLECTOR_TOKEN',
    ]) {
      if ((payload[required] ?? '').length === 0) {
        throw new Error(
          `room-worker: ${required} is required in prd unless OBSERVABILITY_ENABLED=0`
        );
      }
    }
  }
  const buildSha = process.env['VITE_COMMIT_HASH']?.trim() ?? '';
  if (buildSha.length > 0) payload['BUILD_SHA'] = buildSha;

  const bulkPath = join(tmpdir(), `wrangler-room-secrets-${process.pid}.json`);
  writeFileSync(bulkPath, JSON.stringify(payload), 'utf8');
  try {
    await runAsync('wrangler', wranglerArgs('secret', 'bulk', bulkPath), {
      cwd: roomDir,
      env: wranglerEnv(),
      label: 'room-worker: wrangler secret bulk',
    });
  } finally {
    rmSync(bulkPath, { force: true });
  }
  ok(
    'Room Worker secrets',
    `pushed ${String(Object.keys(payload).length)} bindings`
  );
}

async function deploy(dryRun: boolean): Promise<void> {
  const args = dryRun
    ? wranglerArgs('deploy', '--dry-run')
    : wranglerArgs('deploy');
  const label = dryRun
    ? 'room-worker: Cloudflare Workers deploy (dry-run)'
    : 'room-worker: Cloudflare Workers deploy';

  if (!dryRun) await pushRoomWorkerBindings();

  await runAsync('wrangler', args, {
    cwd: roomDir,
    env: wranglerEnv(),
    label,
  });

  if (dryRun) {
    ok('room-worker dry-run', 'room durable object worker validated locally');
    return;
  }

  log.info(`Room Worker deployed (${PRODUCT_CONFIG.cloudflare.roomWorker}).`);
}

const dryRun = !isProductionSecretsEnv();
if (dryRun) {
  log.info('[room-server:deploy] dry-run (SECRETS_ENV is not prd)');
}
await deploy(dryRun);
