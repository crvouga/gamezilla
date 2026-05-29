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
