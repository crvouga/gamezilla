import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';

/**
 * Better Auth’s `bearer()` plugin only copies the session cookie into
 * `set-auth-token` when the response includes a new `Set-Cookie`. After Google
 * OAuth the cookie is already on the browser, so later `get-session` calls
 * return a session but never expose a bearer — AuthBridge never writes
 * `sessionToken` and the account UI stays on “Sign in”.
 *
 * Re-expose the request session cookie as `set-auth-token` whenever a session
 * is present and the header was not already set.
 */
export function exposeBearerFromSessionCookie(): BetterAuthPlugin {
  return {
    id: 'expose-bearer-from-session-cookie',
    hooks: {
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.context.responseHeaders?.get('set-auth-token')) return;
            if (ctx.context.session === null || ctx.context.session === undefined) {
              return;
            }
            const cookieName = ctx.context.authCookies.sessionToken.name;
            const token = ctx.getCookie(cookieName)?.trim() ?? '';
            if (token.length === 0) return;
            ctx.setHeader('set-auth-token', token);
            const exposed =
              ctx.context.responseHeaders?.get(
                'access-control-expose-headers'
              ) ?? '';
            const headersSet = new Set(
              exposed
                .split(',')
                .map((header) => header.trim())
                .filter(Boolean)
            );
            headersSet.add('set-auth-token');
            ctx.setHeader(
              'Access-Control-Expose-Headers',
              [...headersSet].join(', ')
            );
          }),
        },
      ],
    },
  };
}
