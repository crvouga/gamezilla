#!/usr/bin/env bun
// @io-wall-ok — deploy CLI entry.
/**
 * Ships the API Worker's code to the environment in `SECRETS_ENV`. The
 * infrastructure it runs on (secrets, bucket, broker, hostname) is
 * `libs/infra/tofu`, applied before and after this step by the deploy chain.
 */
import { join } from 'node:path';
import { deployWorker } from '@libs/infra/scripts/worker-deploy';
import { ok } from '@libs/secrets/shared/fmt';
import {
  activeEnvFile,
  getApiWorkerSecrets,
  refreshSecretsIntoEnv,
} from '@libs/secrets/shared/secrets/secrets';
import { assert } from '@pkgs/assert';

const WORKER_EXTRA_ENV_KEYS = ['OBSERVABILITY_ENABLED'] as const;

async function workerSecrets(): Promise<Record<string, string>> {
  await refreshSecretsIntoEnv();
  const scope = activeEnvFile().env;
  const payload: Record<string, string> = { SECRETS_ENV: scope };
  for (const entry of getApiWorkerSecrets()) {
    const value = (process.env[entry.name] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional) continue;
      assert.fail(
        `Worker deploy: missing secret ${entry.name} (add to secrets env \`${scope}\`)`
      );
    }
    payload[entry.name] = value;
  }
  for (const key of WORKER_EXTRA_ENV_KEYS) {
    const value = (process.env[key] ?? '').trim();
    if (value.length > 0) payload[key] = value;
  }
  return payload;
}

const secrets = await workerSecrets();
deployWorker({ appDir: join(import.meta.dirname, '..'), role: 'api', secrets });
ok(
  'API Worker',
  `deployed to ${activeEnvFile().env} with ${String(Object.keys(secrets).length)} secrets`
);
