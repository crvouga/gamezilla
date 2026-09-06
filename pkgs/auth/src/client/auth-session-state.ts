import type { VerifiedSession } from '../shared/verified-session';

/** Session snapshot published by {@link AuthSessionStore}. */
export type AuthSessionState = {
  readonly session: VerifiedSession | null;
  readonly isHydrated: boolean;
  readonly error: Error | null;
};

/**
 * Framework-free reactive session store exposed on
 * {@link ../client/auth-client-port AuthClientPort.session}. UI frameworks
 * bridge it with their own subscription primitive (`createSubscriptionSignal`
 * in Solid). `refresh()` re-reads the bearer store and re-verifies the session
 * against the IdP; the adapter calls it after every sign-in / sign-out.
 */
export type AuthSessionStore = {
  readonly getSnapshot: () => AuthSessionState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly refresh: () => Promise<void>;
};

export const AUTH_SESSION_INITIAL: AuthSessionState = {
  session: null,
  isHydrated: false,
  error: null,
};
