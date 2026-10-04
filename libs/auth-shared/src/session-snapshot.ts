/**
 * Helpers over IdP {@link AuthSessionState} for ceremony / reconcile
 * (AuthBridge, sign-in modal). Steady-state chrome uses
 * {@link resolveHasAuthSession} / secure storage instead.
 */

import type { AuthSessionState } from '@pkgs/auth-root-shared/auth-session-state';

/** True when the IdP session atom reports a live session. */
export function isAuthSessionSignedIn(state: AuthSessionState): boolean {
  return state.isHydrated && state.error === null && state.session !== null;
}

/** Coerce the session state's error field into an `Error`, or `null` when absent. */
export function authSessionError(state: AuthSessionState): Error | null {
  return state.error;
}
