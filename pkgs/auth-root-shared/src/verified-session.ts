/**
 * Provider-neutral session view returned by `AuthServerPort.verifySessionToken`
 * and surfaced on the client via `AuthClientPort.session`.
 */
export type VerifiedSession = {
  /** Trusted provider provenance. Absent means unknown, never real by default. */
  readonly synthetic?: boolean;
  /** Id in the auth service's namespace (`AuthUser.externalUserId`). */
  readonly externalUserId: string;
  /** Product account UUID when the adapter knows it; usually `null`. */
  readonly accountId: string | null;
  readonly email: string | null;
  readonly expiresAt: Date | null;
  /** Time the person proved this account; refreshing a token does not change it. */
  readonly authenticatedAt: Date | null;
};
