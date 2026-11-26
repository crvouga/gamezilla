import { expect, test } from 'bun:test';
import { envFile } from '@libs/infra-shared-ts/envs';
import { getApiWorkerSecrets } from '@libs/secrets-server-ts/registry';
import { workerSecretPayload } from '@libs/secrets-server-ts/worker-secrets';

test('the admin Worker authenticates through Hyperdrive without receiving migration, monitor, or billing credentials', () => {
  const inputs = Object.fromEntries(
    getApiWorkerSecrets().map((secret) => [secret.name, 'fixture-value'])
  );
  inputs['DATABASE_URL'] = 'postgresql://migrate:fixture@dev.example.test/app';
  const payload = workerSecretPayload(envFile('dev'), inputs, 'admin');
  expect(payload['DATABASE_URL']).toBe('postgresql://dev.example.test/app');
  expect(payload['AUTH_SECRET']).toBe(inputs['AUTH_SECRET']);
  expect(payload['SYNTHETIC_MONITOR_TOKEN']).toBeUndefined();
  expect(payload['STRIPE_SECRET_KEY']).toBeUndefined();
});
