import { createPatchDbApiHandler } from '@gamezilla/patch-db/api';
import type { Context, Hono } from 'hono';
import type { ApiHandlerConfig } from '../api-types';

export function registerPatchDbRoutes(
  app: Hono,
  config: ApiHandlerConfig
): void {
  const { handleRequest, basePath } = createPatchDbApiHandler(config);

  const delegate = async (c: Context) => {
    const res = await handleRequest(c.req.raw);
    if (res === null) {
      return c.text('Not Found', 404);
    }
    return res;
  };

  app.all(`${basePath}`, delegate);
  app.all(`${basePath}/*`, delegate);
}
