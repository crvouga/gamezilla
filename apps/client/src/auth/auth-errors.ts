/**
 * Typed errors for auth flows (client).
 */

/** User-visible when client config has no Clerk publishable key synced from Doppler. */
export const CLERK_SIGN_IN_UNAVAILABLE_REASON =
  'Sign-in is not configured on this server. Ensure CLERK_PUBLISHABLE_KEY is in Doppler, the API Worker has DOPPLER_TOKEN, and client config has been refreshed.';

export class AuthConfigurationError extends Error {
  readonly code = 'clerk_not_configured' as const;

  constructor(message: string = CLERK_SIGN_IN_UNAVAILABLE_REASON) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export function isAuthConfigurationError(
  value: unknown
): value is AuthConfigurationError {
  return value instanceof AuthConfigurationError;
}
