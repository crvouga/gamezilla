// @io-wall-ok — application deployment secrets composition root.
import {
  activeEnvFile,
  getApiWorkerSecrets,
  refreshSecretsIntoEnv,
} from '@libs/secrets/shared/secrets/secrets';
import { assert } from '@pkgs/assert';

const WORKER_EXTRA_ENV_KEYS = ['OBSERVABILITY_ENABLED'] as const;

export async function workerSecrets(): Promise<Record<string, string>> {
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

/** OpenTofu's Hyperdrive config for this env (foundation writes the id). */
export function hyperdriveId(): string {
  const id = (process.env['HYPERDRIVE_ID'] ?? '').trim();
  assert.nonEmptyString(
    id,
    `Worker deploy: missing HYPERDRIVE_ID in secrets env \`${activeEnvFile().env}\` (run @libs/infra#apply:foundation)`
  );
  return id;
}
