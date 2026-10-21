/**
 * Loopback-origin check shared by the auth server and the auth client.
 *
 * Used to gate dev-only behaviour on loopback API origins so it can never run
 * against production. Server and client compute the same answer from the same
 * string, eliminating drift.
 */
export function isLocalApiOrigin(apiOrigin: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(apiOrigin);
}
