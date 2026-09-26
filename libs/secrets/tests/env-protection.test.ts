import { describe, expect, test } from 'bun:test';
import { type EnvFile, parseEnvFile } from '@libs/infra/public/env-file';
import { ENV_FILES, PRODUCTION_ENV_NAMES } from '@libs/infra/public/envs';
import { ObservabilitySecretName } from '@libs/observability/public/secret-names';
import { SECRETS, validateSecretOrError } from '@libs/secrets/public/secrets';
import { REPO_SECRETS_ENVS } from '@libs/secrets/shared/secrets/secrets-envs';

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
  test('every env file is a secrets env; production ones are the protected ones', () => {
    expect([...REPO_SECRETS_ENVS.all].sort()).toEqual(
      Object.keys(ENV_FILES).sort()
    );
    expect(REPO_SECRETS_ENVS.production).toEqual(PRODUCTION_ENV_NAMES);
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
});
