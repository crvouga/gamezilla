/** Native / non-browser OAuth return for auth sessions. */
export const AUTH_NATIVE_SSO_CALLBACK_URL = 'gamezilla://sso-callback';

/**
 * Client OAuth return URL for `openAuthSession`.
 *
 * When a browser origin is present (`http:` / `https:`), return same-origin
 * `/sso-callback` so sign-in completes in the returning document. Otherwise return the native custom scheme.
 */
export function oauthClientCallbackUrl(origin: string | undefined): string {
  if (origin === undefined) return AUTH_NATIVE_SSO_CALLBACK_URL;
  const trimmed = origin.trim().replace(/\/$/, '');
  if (trimmed.length === 0) return AUTH_NATIVE_SSO_CALLBACK_URL;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return AUTH_NATIVE_SSO_CALLBACK_URL;
  }
  return `${trimmed}/sso-callback`;
}
