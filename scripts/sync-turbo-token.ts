#!/usr/bin/env bun
/**
 * Push the current Doppler `TURBO_TOKEN` to the `gamezilla-turbo-cache`
 * Worker. Use this when `bun check` fails with `HTTP 401` from the remote
 * cache: Doppler is the source of truth, but Cloudflare Worker secrets
 * don't auto-propagate, so any token rotation in Doppler leaves the
 * Worker stale until someone re-syncs.
 *
 * Reads `TURBO_TOKEN` from the Doppler `prod` config (same as
 * `bun run infra deploy`'s `syncTurboToken()` in
 * `libs/infra/src/cli/resources/turbo-cache.ts`).
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const WORKER_DIR = join(REPO_ROOT, 'packages', 'turbo-cache');

function fetchTurboToken(): string {
  const r = spawnSync('doppler', ['secrets', 'get', 'TURBO_TOKEN', '--plain'], {
    env: {
      ...process.env,
      DOPPLER_PROJECT: 'gamezilla',
      DOPPLER_CONFIG: 'prod',
    },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error('Failed to read TURBO_TOKEN from Doppler prod:');
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  const token = r.stdout.trim();
  if (token.length === 0) {
    console.error('Doppler prod TURBO_TOKEN is empty.');
    process.exit(1);
  }
  return token;
}

function pushToWorker(token: string): void {
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']?.trim() ?? '';
  const r = spawnSync('bunx', ['wrangler', 'secret', 'put', 'TURBO_TOKEN'], {
    cwd: WORKER_DIR,
    env: {
      ...process.env,
      ...(accountId.length > 0 ? { CLOUDFLARE_ACCOUNT_ID: accountId } : {}),
    },
    input: token,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (r.status !== 0) {
    console.error('wrangler secret put failed.');
    process.exit(r.status ?? 1);
  }
}

const token = fetchTurboToken();
pushToWorker(token);
console.log(
  'Synced Doppler `prod` TURBO_TOKEN → gamezilla-turbo-cache Worker. ' +
    'Re-run `bun check` to verify.'
);
