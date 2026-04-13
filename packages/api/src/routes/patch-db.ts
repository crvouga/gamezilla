import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import type { Hono } from 'hono';
import type { ApiHandlerConfig } from '../api-types';

export function registerPatchDbRoutes(
  app: Hono,
  config: ApiHandlerConfig
): void {
  const { honoApp, basePath } = createPatchDbApiHandler(config);
  app.route(basePath, honoApp);
}
