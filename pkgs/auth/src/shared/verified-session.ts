/**
 * Provider-neutral session view returned by `AuthServerPort.verifySessionToken`
 * and surfaced on the client via `AuthClientPort.session`.
 */
export type VerifiedSession = {
  /** Id in the auth service's namespace (`AuthUser.externalUserId`). */
  readonly externalUserId: string;
  /** Product account UUID when the adapter knows it; usually `null`. */
  readonly accountId: string | null;
  readonly email: string | null;
  readonly expiresAt: Date | null;
};
