import type { VerifiedSession } from '../shared/verified-session';

/** Reactive session snapshot from {@link AuthClientPort.useAuthSession}. */
export type AuthSessionState = {
  readonly session: VerifiedSession | null;
  readonly isHydrated: boolean;
  readonly error: Error | null;
};
