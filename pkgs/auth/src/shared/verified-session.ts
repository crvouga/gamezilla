/**
 * Provider-neutral session view returned by {@link ../server/auth-server-port AuthServerPort.verifySessionToken}
 * and surfaced on the client via {@link ../client/auth-client-port AuthClientPort.useAuthSession}.
 */
export type VerifiedSession = {
  /** Id in the auth provider namespace (external user id from the auth adapter). */
  readonly externalUserId: string;
  /** App-internal account UUID when provisioned; null for anonymous-only flows. */
  readonly accountId: string | null;
  readonly email: string | null;
  readonly expiresAt: Date | null;
};
