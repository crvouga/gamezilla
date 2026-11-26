// @io-wall-ok — application deployment secrets composition root.

import type { EnvFile } from '@libs/infra-shared-ts/env-file';
import { apiWorkerVars } from '@libs/infra-shared-ts/env-file';
import { activeEnvFile } from '@libs/secrets-shared-ts/secret';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { normalizeDatabaseUrlForCompare } from '@pkgs/database-url-policy-shared-ts/database-url-policy';
import { getAdminWorkerSecrets, getApiWorkerSecrets } from './registry';
import { refreshSecretsIntoEnv } from './secrets';

type WorkerAudience = 'product' | 'admin';

const WORKER_EXTRA_ENV_KEYS = ['OBSERVABILITY_ENABLED'] as const;

export async function workerSecrets(
  audience: WorkerAudience = 'product'
): Promise<Record<string, string>> {
  await refreshSecretsIntoEnv();
  return workerSecretPayload(activeEnvFile(), process.env, audience);
}

/** Public endpoint bindings belong to the env file, never a copied secret. */
export function workerSecretPayload(
  env: EnvFile,
  values: Readonly<Record<string, string | undefined>>,
  audience: WorkerAudience = 'product'
): Record<string, string> {
  const scope = env.env;
  const vars = apiWorkerVars(env);
  const payload: Record<string, string> = { SECRETS_ENV: scope };
  const entries =
    audience === 'admin' ? getAdminWorkerSecrets() : getApiWorkerSecrets();
  for (const entry of entries) {
    if (entry.name in vars) continue;
    const value = (values[entry.name] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional) continue;
      assert.fail(
        `Worker deploy: missing secret ${entry.name} (add to secrets env \`${scope}\`)`
      );
    }
    // The database policy needs the origin. Hyperdrive authenticates the admin Worker.
    payload[entry.name] =
      audience === 'admin' && entry.name === 'DATABASE_URL'
        ? normalizeDatabaseUrlForCompare(value)
        : value;
  }
  for (const key of WORKER_EXTRA_ENV_KEYS) {
    const value = (values[key] ?? '').trim();
    if (value.length > 0) payload[key] = value;
  }
  return payload;
}

/** OpenTofu's Hyperdrive config for this env (foundation writes the id). */
export function hyperdriveId(): string {
  const id = (process.env['HYPERDRIVE_ID'] ?? '').trim();
  assert.nonEmptyString(
    id,
    `Worker deploy: missing HYPERDRIVE_ID in secrets env \`${activeEnvFile().env}\` (run @libs/infra#apply:foundation)`
  );
  return id;
}
