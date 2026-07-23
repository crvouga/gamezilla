/**
 * One auth-provider session registered on this client (multi-session apps).
 * `sessionId` is provider-scoped; map to an internal account id via `/auth/refresh`.
 */
export type AccountSession = {
  readonly sessionId: string;
  readonly externalUserId: string;
  readonly email: string | null;
  /** Provider display username when available (e.g. Clerk publicUserData). */
  readonly username: string | null;
  readonly isActive: boolean;
};

/** Scope for {@link AuthClientPort.signOut}. */
export type SignOutScope = 'active' | 'all';

export type SignOutOptions = {
  readonly scope?: SignOutScope;
};
