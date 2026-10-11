/**
 * Why a sign-in, link or unlink did not go through, as codes the UI can
 * explain. Adapters translate their service's failures into these; anything
 * with no code here surfaces as a plain `Error`.
 */
export const AUTH_ERROR = {
  /** The person cancelled at the provider. */
  cancelled: 'cancelled',
  /** The provider exchange failed (outage, bad token, bad signature). */
  providerFailed: 'provider_failed',
  /** That provider identity already belongs to another user. */
  identityAlreadyLinked: 'identity_already_linked',
  /** This user already has a different identity from that provider. */
  providerAlreadyLinked: 'provider_already_linked',
  /** Unlinking would leave the user with no way to sign in. */
  lastIdentity: 'last_identity',
  /** A pending link was confirmed by signing in as someone else. */
  linkMismatch: 'link_mismatch',
  /** The emailed link / link ticket / pending link / state is unknown, used or expired. */
  expired: 'expired',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];

const ERROR_CODES = new Set<string>(Object.values(AUTH_ERROR));

export function isAuthErrorCode(raw: string): raw is AuthErrorCode {
  return ERROR_CODES.has(raw);
}
