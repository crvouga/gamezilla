/**
 * Small read helpers over {@link AuthSessionState} from {@link AuthClientPort}.
 * Shared by {@link AuthBridge} and the sign-in modal lifecycle so both resolve
 * signed-in / error the same way.
 */

import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';

export function isAuthSessionSignedIn(state: AuthSessionState): boolean {
  return state.isHydrated && state.error === null && state.session !== null;
}

/** Coerce the session state's error field into an `Error`, or `null` when absent. */
export function authSessionError(state: AuthSessionState): Error | null {
  return state.error;
}
