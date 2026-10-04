// @io-wall-ok — application deployment secrets composition root.
import { apiWorkerVars } from '@libs/infra-shared/env-file';
import type { EnvFile } from '@libs/infra-shared/env-file';
import { activeEnvFile } from '@libs/secrets-shared/secret';
import { getApiWorkerSecrets } from '@libs/secrets-server/registry';
import { refreshSecretsIntoEnv } from '@libs/secrets-server/secrets';
import { assert } from '@pkgs/assert-shared/singleton';

const WORKER_EXTRA_ENV_KEYS = ['OBSERVABILITY_ENABLED'] as const;

export async function workerSecrets(): Promise<Record<string, string>> {
  await refreshSecretsIntoEnv();
  return workerSecretPayload(activeEnvFile(), process.env);
}

/** Public endpoint bindings belong to the env file, never a copied secret. */
export function workerSecretPayload(
  env: EnvFile,
  values: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  const scope = env.env;
  const vars = apiWorkerVars(env);
  const payload: Record<string, string> = { SECRETS_ENV: scope };
  for (const entry of getApiWorkerSecrets()) {
    if (entry.name in vars) continue;
    const value = (values[entry.name] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional) continue;
      assert.fail(
        `Worker deploy: missing secret ${entry.name} (add to secrets env \`${scope}\`)`
      );
    }
    payload[entry.name] = value;
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
