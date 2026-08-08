import { Hono } from 'hono';

import type { ApiFeatures } from './api-features';

/** GET `/features` — public capability flags for optional cloud integrations. */
export function createFeaturesApp(features: ApiFeatures) {
  return new Hono().get('/features', (c) => c.json(features, 200));
}
