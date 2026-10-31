/**
 * Native / non-browser OAuth return for a deep-link scheme
 * (`myapp` → `myapp://sso-callback`).
 */
export function nativeSsoCallbackUrl(deepLinkScheme: string): string {
  return `${deepLinkScheme}://sso-callback`;
}

/**
 * Client OAuth return URL for `openAuthSession`.
 *
 * When a browser origin is present (`http:` / `https:`), return same-origin
 * `/sso-callback` so sign-in completes in the returning document. Otherwise
 * return the native callback under the host's deep-link scheme.
 */
export function oauthClientCallbackUrl(
  origin: string | undefined,
  deepLinkScheme: string
): string {
  const native = nativeSsoCallbackUrl(deepLinkScheme);
  if (origin === undefined) return native;
  const trimmed = origin.trim().replace(/\/$/, '');
  if (trimmed.length === 0) return native;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return native;
  }
  return `${trimmed}/sso-callback`;
}
