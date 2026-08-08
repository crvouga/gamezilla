import type { AuthContext } from '@libs/auth/server/types';
import { assert } from '@pkgs/assert';
import {
  type BetterAuthInstance,
  mintE2eSession,
} from '@pkgs/auth-better-auth/server';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '../app/api-hono-types';
import { absolutizeWebAppLocation } from '../config/web-client-origin';

function readBetterAuth(c: {
  get: (key: 'betterAuth') => unknown;
}): BetterAuthInstance {
  const auth = c.get('betterAuth');
  assert.defined(auth, 'betterAuth missing from request context');
  return auth as BetterAuthInstance;
}

function rewriteRelativeOAuthRedirect(
  response: Response,
  webClientOrigin: string
): Response {
  if (response.status < 300 || response.status >= 400) return response;
  const location = response.headers.get('Location');
  if (location === null) return response;
  const absolute = absolutizeWebAppLocation(location, webClientOrigin);
  if (absolute === location) return response;
  const headers = new Headers(response.headers);
  headers.set('Location', absolute);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Mounts Better Auth’s handler at `/auth/*` plus a dev-only E2E mint route.
 */
export function createBetterAuthRoutes(args: {
  readonly secretsEnv: string;
  readonly webClientOrigin: string;
}) {
  const app = new Hono<ApiHonoEnv<AuthContext>>();

  app.on(['POST', 'GET'], '/auth/*', async (c) => {
    const auth = readBetterAuth(c);
    return rewriteRelativeOAuthRedirect(
      await auth.handler(c.req.raw),
      args.webClientOrigin
    );
  });

  if (args.secretsEnv === 'dev') {
    app.post('/identity/e2e/sign-in', async (c) => {
      const auth = readBetterAuth(c);
      const raw: unknown = await c.req.json().catch(() => null);
      const email =
        raw !== null &&
        typeof raw === 'object' &&
        typeof (raw as { email?: unknown }).email === 'string'
          ? (raw as { email: string }).email
          : '';
      const minted = await mintE2eSession({ auth, email });
      return c.json(minted, 200);
    });
  }

  return app;
}
