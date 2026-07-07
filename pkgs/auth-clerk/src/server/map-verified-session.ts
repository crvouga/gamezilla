import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';

type ClerkJwtPayload = {
  readonly sub?: string;
  readonly exp?: number;
};

export function mapClerkJwtToVerifiedSession(
  payload: ClerkJwtPayload
): VerifiedSession | null {
  const externalUserId = payload.sub;
  if (externalUserId === undefined || externalUserId.length === 0) {
    return null;
  }

  const expiresAt =
    payload.exp === undefined ? null : new Date(payload.exp * 1000);

  return {
    externalUserId,
    accountId: null,
    email: null,
    expiresAt,
  };
}
