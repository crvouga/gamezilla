/**
 * The OAuth callback relay Worker (`auth.<zone>`): the only `redirect_uri`
 * registered with Google. Every environment tags the `state` it mints with
 * its name; this Worker forwards each callback to that environment's API,
 * query or `form_post` body intact, and refuses any other. It holds no
 * secret and no data — the launching environment finishes the sign-in
 * against its own state row (`@pkgs/auth-inhouse` `oauth-callback-relay.ts`).
 */
import {
  createOauthCallbackRelayApp,
  parseRelayTargets,
} from '@pkgs/auth-inhouse-server-ts/oauth-callback-relay';
import type { Hono } from 'hono';

export type AuthRelayEnv = {
  /** JSON `{ envTag: apiOrigin }`, rendered by `@libs/infra/public/wrangler`. */
  readonly OAUTH_RELAY_TARGETS?: string;
};

/** Every environment's API serves auth under this prefix (`createServer`). */
const PUBLIC_PATH_PREFIX = '/api';

let built: { readonly raw: string; readonly app: Hono } | null = null;

function relayApp(env: AuthRelayEnv): Hono {
  const raw = env.OAUTH_RELAY_TARGETS ?? '{}';
  if (built?.raw !== raw) {
    built = {
      raw,
      app: createOauthCallbackRelayApp({
        forwardTo: parseRelayTargets(raw, 'OAUTH_RELAY_TARGETS'),
        publicPathPrefix: PUBLIC_PATH_PREFIX,
      }),
    };
  }
  return built.app;
}

export default {
  fetch(request: Request, env: AuthRelayEnv): Promise<Response> {
    return Promise.resolve(relayApp(env).fetch(request));
  },
};
