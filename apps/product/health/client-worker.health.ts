// @io-wall-ok — live health probe (the environment's client assets Worker).
import { describe, expect, test } from 'bun:test';
import { envOrigins } from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import { httpProbe } from '@libs/secrets/shared/http-probe';

const PROBE_TIMEOUT_MS = 15_000;

const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
const origins = envOrigins(env);

describe(`client worker (${env.env})`, () => {
  for (const path of ['/', '/simulator']) {
    test(`www serves the app shell at ${path}`, async () => {
      const result = await httpProbe(`${origins.web}${path}`, PROBE_TIMEOUT_MS);
      expect(result.status).toBe(200);
      expect(result.body ?? '').toContain('id="root"');
    });
  }

  test('apex domain serves or redirects to www', async () => {
    const result = await httpProbe(`${origins.apex}/`, PROBE_TIMEOUT_MS);
    expect(result.status ?? 0).toBeGreaterThanOrEqual(200);
    expect(result.status ?? 0).toBeLessThan(400);
  });
});
