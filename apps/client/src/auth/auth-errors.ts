/**
 * Typed errors for auth flows (client).
 */

/** User-visible when the client has no API URL (hosted auth unreachable). */
export const HOSTED_SIGN_IN_UNAVAILABLE_REASON =
  'Sign-in is not available. Configure EXPO_PUBLIC_API_URL (or your build-time API URL) so this app can reach the server’s hosted auth.';

export class HostedAuthNotConfiguredError extends Error {
  readonly code = 'hosted_auth_not_configured' as const;

  constructor(message: string = HOSTED_SIGN_IN_UNAVAILABLE_REASON) {
    super(message);
    this.name = 'HostedAuthNotConfiguredError';
  }
}

export function isHostedAuthNotConfiguredError(
  value: unknown
): value is HostedAuthNotConfiguredError {
  return value instanceof HostedAuthNotConfiguredError;
}
