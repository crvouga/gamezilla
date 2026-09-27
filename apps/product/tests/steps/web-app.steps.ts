// @io-wall-ok — live health: the environment's client assets Worker.
/** `specs/health/web-app.feature`. */

import { expect } from 'bun:test';
import { httpProbe } from '@libs/secrets/shared/http-probe';
import { Then } from './define';

const PROBE_TIMEOUT_MS = 15_000;

Then('the web app serves its shell at {string}', async (w, path: string) => {
  const result = await httpProbe(`${w.origins.web}${path}`, PROBE_TIMEOUT_MS);
  expect(result.status).toBe(200);
  expect(result.body ?? '').toContain('id="root"');
});

Then('the apex domain answers without an error', async (w) => {
  const result = await httpProbe(`${w.origins.apex}/`, PROBE_TIMEOUT_MS);
  expect(result.status ?? 0).toBeGreaterThanOrEqual(200);
  expect(result.status ?? 0).toBeLessThan(400);
});
