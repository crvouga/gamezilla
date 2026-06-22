/**
 * Compile-time constants for the local OAuth2 / OIDC identity provider
 * exposed by {@link @pkgs/dev-idp}. These are intentionally non-secrets —
 * the IdP only runs on the developer's machine (alongside Postgres, Expo,
 * etc.) so there is nothing to protect. Hard-coding them keeps the whole
 * package independent of any infra plumbing (Vault / env / wrangler).
 *
 * The dev IdP is **its own process**, the same way `@libs/stripe-cli` shells out to the
 * Stripe CLI. The default origin below is what every consumer (Better Auth's
 * generic-oauth provider, the API worker, Playwright) treats as the IdP
 * authority during local development.
 */

/** Provider id used by Better Auth `genericOAuth` to identify this IdP. */
export const DEV_IDP_PROVIDER_ID = 'dev';

/** Public label shown in user-facing UI ("Test Account"). */
export const DEV_IDP_PROVIDER_LABEL = 'Test Account';

/** Fake OAuth `client_id` shared between the IdP and the Better Auth provider config. */
export const DEV_IDP_CLIENT_ID = 'dev-idp-client';

/** Fake OAuth `client_secret` shared between the IdP and the Better Auth provider config. */
export const DEV_IDP_CLIENT_SECRET = 'dev-idp-secret';

/**
 * URL prefix where the dev IdP Hono router mounts inside the standalone
 * server. The whole server *is* the IdP, but we keep this prefix so the
 * IdP "namespace" is visible in URLs (e.g. `http://127.0.0.1:5556/dev-idp/
 * authorize`) and matches the path Playwright tests already assert on.
 */
export const DEV_IDP_PATH_PREFIX = '/dev-idp';

/**
 * Default TCP port for the standalone dev IdP HTTP server. Picked to sit
 * adjacent to common dev ports in the developer's mental port map.
 */
export const DEV_IDP_DEFAULT_PORT = 5556;

/**
 * Default origin used by Better Auth's `genericOAuth` dev provider config
 * to reach this server. `127.0.0.1` (not `localhost`) matches the host
 * the postgres dev cluster binds to and avoids any IPv6 fallback surprise
 * (`localhost` can resolve to `::1`, which Bun.serve won't be listening on
 * by default).
 */
export const DEV_IDP_DEFAULT_ORIGIN = `http://127.0.0.1:${DEV_IDP_DEFAULT_PORT}`;

/** Resolves the dev IdP TCP port from an optional `DEV_IDP_PORT` binding. */
export function readDevIdpPortFromBinding(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return DEV_IDP_DEFAULT_PORT;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 65_535) {
    return DEV_IDP_DEFAULT_PORT;
  }
  return n;
}

/** Loopback origin for the standalone dev IdP (`127.0.0.1`, not `localhost`). */
export function resolveDevIdpOrigin(port?: number): string {
  const resolved =
    port ??
    readDevIdpPortFromBinding(
      typeof process !== 'undefined' ? process.env['DEV_IDP_PORT'] : undefined
    );
  return `http://127.0.0.1:${String(resolved)}`;
}

/** Default OAuth scopes — emulate Google "openid email profile". */
export const DEV_IDP_SCOPES: readonly string[] = ['openid', 'email', 'profile'];

/** Authorization-code lifetime (ms). Short — codes are exchanged immediately by the callback. */
export const DEV_IDP_CODE_TTL_MS = 5 * 60 * 1000;

/** Access-token lifetime (seconds). Better Auth records this as `accessTokenExpiresAt`. */
export const DEV_IDP_ACCESS_TOKEN_TTL_SEC = 60 * 60;

/** Issuer claim used in OIDC tokens / discovery (assembled from the runtime origin). */
export function devIdpIssuer(origin: string): string {
  return `${origin.replace(/\/$/, '')}${DEV_IDP_PATH_PREFIX}`;
}

/** Path-relative endpoint URLs for the IdP, joined onto the mount prefix. */
export const DEV_IDP_ENDPOINTS = {
  authorize: '/authorize',
  authorizeComplete: '/authorize/complete',
  token: '/token',
  userinfo: '/userinfo',
  users: '/users',
} as const;

/** Fully-qualified URL builder for each IdP endpoint (used when wiring the auth provider). */
export function devIdpEndpointUrl(
  origin: string,
  endpoint: keyof typeof DEV_IDP_ENDPOINTS
): string {
  return `${origin.replace(/\/$/, '')}${DEV_IDP_PATH_PREFIX}${DEV_IDP_ENDPOINTS[endpoint]}`;
}
