import type { AuthIdentity } from './auth-identity';

/** A user as the auth service knows them. */
export type AuthUser = {
  /** Id in the auth service's namespace (never the product account id). */
  readonly externalUserId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  /** Every sign-in method on the user, at most one per provider. */
  readonly identities: readonly AuthIdentity[];
};
