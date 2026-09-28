// @io-wall-ok — live health: the environment's client assets Worker.
/** `specs/health/reaching-the-app.feature`. */

import { expect } from 'bun:test';
import { httpProbe } from '@libs/secrets/shared/http-probe';
import { Then } from './define';
import type { LiveWorld } from './live-world';

const PROBE_TIMEOUT_MS = 15_000;

/** `path` on www answers with the app's page. */
async function expectPageAt(w: LiveWorld, path: string): Promise<void> {
  const result = await httpProbe(`${w.origins.web}${path}`, PROBE_TIMEOUT_MS);
  expect(result.status).toBe(200);
  expect(result.body ?? '').toContain('id="root"');
}

Then('people can open the app at its address', async (w) => {
  await expectPageAt(w, '/');
});

Then('the team can open the testing tool at its address', async (w) => {
  await expectPageAt(w, '/harness');
});

Then('the address without "www" leads people to the app', async (w) => {
  const result = await httpProbe(`${w.origins.apex}/`, PROBE_TIMEOUT_MS);
  expect(result.status ?? 0).toBeGreaterThanOrEqual(200);
  expect(result.status ?? 0).toBeLessThan(400);
});
