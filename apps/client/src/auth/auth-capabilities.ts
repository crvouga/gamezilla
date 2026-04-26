import { GOOGLE_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';

export type AuthGoogleProviderState = {
  available: boolean;
  unavailableReason: string | null;
};

/**
 * Derives whether Google sign-in can run in the client (synced web client id present).
 */
export function deriveGoogleProviderState(
  googleWebClientId: string | null | undefined
): AuthGoogleProviderState {
  const available =
    typeof googleWebClientId === 'string' && googleWebClientId.trim().length > 0;
  return {
    available,
    unavailableReason: available ? null : GOOGLE_SIGN_IN_UNAVAILABLE_REASON,
  };
}
