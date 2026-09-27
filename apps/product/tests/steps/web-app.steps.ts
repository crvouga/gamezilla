// @io-wall-ok — live health: the environment's client assets Worker.
/** `specs/health/reaching-the-app.feature`. */

import { expect } from 'bun:test';
import { httpProbe } from '@libs/secrets/shared/http-probe';
import { Then } from './define';

const PROBE_TIMEOUT_MS = 15_000;

/** The place a person opens → the path that serves it on www. */
const PLACE_PATHS: Readonly<Record<string, string>> = {
  'the app': '/',
  'the Simulator': '/simulator',
};

Then('people can open {string} at its address', async (w, place: string) => {
  const path = PLACE_PATHS[place];
  expect(path, `no address known for ${place}`).toBeDefined();
  const result = await httpProbe(`${w.origins.web}${path}`, PROBE_TIMEOUT_MS);
  expect(result.status).toBe(200);
  expect(result.body ?? '').toContain('id="root"');
});

Then('the address without "www" leads people to the app', async (w) => {
  const result = await httpProbe(`${w.origins.apex}/`, PROBE_TIMEOUT_MS);
  expect(result.status ?? 0).toBeGreaterThanOrEqual(200);
  expect(result.status ?? 0).toBeLessThan(400);
});
