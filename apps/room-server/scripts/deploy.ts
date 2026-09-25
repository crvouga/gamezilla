#!/usr/bin/env bun
// @io-wall-ok — deploy CLI entry.
/**
 * Ships the room Durable Object Worker's code to the environment in
 * `SECRETS_ENV`. Its migrations may add or rename classes only
 * (`@libs/infra/public/wrangler` refuses a deleted class), and a migration
 * error fails the deploy — the Worker is never deleted to "fix" it.
 */
import { join } from 'node:path';
import { deployWorker } from '@libs/infra/scripts/worker-deploy';
import { ok } from '@libs/secrets/shared/fmt';
import {
  activeSecretsEnv,
  refreshSecretsIntoEnv,
} from '@libs/secrets/shared/secrets/secrets';

async function workerSecrets(): Promise<Record<string, string>> {
  await refreshSecretsIntoEnv();
  const payload: Record<string, string> = { SECRETS_ENV: activeSecretsEnv() };
  for (const key of [
    'OBSERVABILITY_COLLECTOR_URL',
    'OBSERVABILITY_COLLECTOR_USER',
    'OBSERVABILITY_COLLECTOR_TOKEN',
    'OBSERVABILITY_ENABLED',
  ] as const) {
    const value = process.env[key]?.trim() ?? '';
    if (value.length > 0) payload[key] = value;
  }
  const buildSha = process.env['VITE_COMMIT_HASH']?.trim() ?? '';
  if (buildSha.length > 0) payload['BUILD_SHA'] = buildSha;
  return payload;
}

deployWorker({
  appDir: join(import.meta.dirname, '..'),
  role: 'room',
  secrets: await workerSecrets(),
});
ok('Room Worker', `deployed to ${activeSecretsEnv()}`);
