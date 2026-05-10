import { assert } from '@gamezilla/lib/assert';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { Hono } from 'hono';
import type { ApiHonoEnv } from '../../app/api-hono-types';
import { withBetterAuthBrowserCorsForRequest } from '../../app/cors';

export async function mountHostedAuthRoutes(
  app: Hono<ApiHonoEnv>,
  _secretStore: SecretStore
): Promise<void> {
  app.all('/api/auth/*', async (c) => {
    const auth = c.get('betterAuth');
    assert.defined(
      auth,
      'betterAuth missing — ensure request-scoped middleware ran before hosted auth routes'
    );
    const req = c.req.raw;
    const res = await auth.handler(req);
    return withBetterAuthBrowserCorsForRequest(req, res);
  });
}
