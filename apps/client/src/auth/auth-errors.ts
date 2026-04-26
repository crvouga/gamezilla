/**
 * Typed errors for auth flows (client).
 */

/** User-visible when the API has no web Google client id / client config has none synced. */
export const GOOGLE_SIGN_IN_UNAVAILABLE_REASON =
  'Google sign-in is not configured on this server. Ensure WEB_CLIENT_GOOGLE_CLIENT_ID is in Doppler, the API Worker has DOPPLER_TOKEN, and client config has been refreshed.';

export class AuthConfigurationError extends Error {
  readonly code = 'google_not_configured' as const;

  constructor(message: string = GOOGLE_SIGN_IN_UNAVAILABLE_REASON) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export function isAuthConfigurationError(
  value: unknown
): value is AuthConfigurationError {
  return value instanceof AuthConfigurationError;
}
