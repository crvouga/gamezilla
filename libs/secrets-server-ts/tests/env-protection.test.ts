import { describe, expect, test } from 'bun:test';
import type { EnvFile } from '@libs/infra-shared-ts/env-file';
import { parseEnvFile } from '@libs/infra-shared-ts/env-file';
import { ENV_FILES, PRODUCTION_ENV_NAMES } from '@libs/infra-shared-ts/envs';
import { ObservabilitySecretName } from '@libs/observability-shared-ts/secret-names';
import { SECRETS } from '@libs/secrets-server-ts/registry';
import { validateSecretOrError } from '@libs/secrets-shared-ts/secret';
import { REPO_SECRETS_ENVS } from '@libs/secrets-shared-ts/secrets-envs';
import { SHARED_SECRETS_ENV } from '@libs/secrets-shared-ts/shared-secrets';

function synthetic(name: string, protection: EnvFile['protection']): EnvFile {
  const dev = ENV_FILES['dev'];
  if (dev === undefined) throw new Error('dev env file missing');
  return parseEnvFile(
    { ...dev, env: name, protection },
    `synthetic ${name}.tfvars.json`
  );
}

const collector = SECRETS.find(
  (s) => s.name === ObservabilitySecretName.collectorUrl
);

describe('secrets and environment protection', () => {
  test('every env file is a secrets env, plus the shared one; production ones and shared are never cached', () => {
    expect([...REPO_SECRETS_ENVS.all].sort()).toEqual(
      [...Object.keys(ENV_FILES), SHARED_SECRETS_ENV].sort()
    );
    expect(REPO_SECRETS_ENVS.production).toEqual([
      ...PRODUCTION_ENV_NAMES,
      SHARED_SECRETS_ENV,
    ]);
  });

  test('validators treat a new standard env as non-production, whatever its name', async () => {
    expect(collector).toBeDefined();
    if (collector === undefined) return;
    const plainHttp = 'http://collector.internal:4318/v1/traces';
    for (const name of ['staging', 'prd-mirror']) {
      expect(
        await validateSecretOrError(collector, {
          env: synthetic(name, 'standard'),
          secretValue: plainHttp,
          secrets: new Map(),
        })
      ).toBeNull();
    }
    expect(
      await validateSecretOrError(collector, {
        env: synthetic('live', 'production'),
        secretValue: plainHttp,
        secrets: new Map(),
      })
    ).toMatch(/https:\/\/ in production/);
  });

  test('the read-only database url is checked by shape and is not pinged', async () => {
    const readonly = SECRETS.find(
      (s) => s.name === ObservabilitySecretName.readonlyDatabaseUrl
    );
    expect(readonly?.optional).toBe(true);
    expect(readonly?.managedBy).toBe('tofu');
    if (readonly === undefined) return;
    const env = synthetic('live', 'production');
    expect(
      await validateSecretOrError(readonly, {
        env,
        secretValue: 'postgresql://obs_read:secret@db.example/neondb',
        secrets: new Map(),
      })
    ).toBeNull();
    expect(
      await validateSecretOrError(readonly, {
        env,
        secretValue: 'https://tempo.example',
        secrets: new Map(),
      })
    ).toMatch(/postgres/);
  });
});
