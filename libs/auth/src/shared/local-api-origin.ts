/**
 * Loopback-origin check shared by the auth server and the auth client.
 *
 * Used to gate dev-only behaviour — e.g. registering the local OAuth2 IdP
 * (`@pkgs/dev-idp`) and showing the "Continue with test account" button —
 * so it can never run against production. Server and client compute the
 * same answer from the same string, eliminating drift.
 */
export function isLocalApiOrigin(apiOrigin: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(apiOrigin);
}

/**
 * Google OAuth `state` cookies are host-only. On loopback, `localhost` and
 * `127.0.0.1` are different cookie jars — normalize to `localhost` so sign-in,
 * callbacks, and the auth client always share one host.
 */
export function normalizeLoopbackOriginToLocalhost(origin: string): string {
  if (!isLocalApiOrigin(origin)) return origin;
  try {
    const u = new URL(origin);
    if (u.hostname === '127.0.0.1') {
      u.hostname = 'localhost';
      return u.origin;
    }
  } catch {
    /* keep input on parse failure */
  }
  return origin;
}
