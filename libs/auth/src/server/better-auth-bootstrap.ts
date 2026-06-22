import { assert } from '@pkgs/assert';
import type { SecretStore } from '@pkgs/secret-store';
import type { Hono } from 'hono';
import type { ApiHonoEnv } from './api-hono-env';
import { withBetterAuthBrowserCorsForRequest } from './better-auth-cors';

import type { AuthContext } from './types';

export async function mountHostedAuthRoutes(
  app: Hono<ApiHonoEnv<AuthContext>>,
  _secretStore: SecretStore
): Promise<void> {
  app.all('/auth/*', async (c) => {
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
