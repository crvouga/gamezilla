import { Platform } from 'react-native';

/**
 * OAuth return URL for Better Auth / `@better-auth/expo`.
 *
 * Native must pass a relative path so the expo client rewrites it to
 * `{scheme}:///sso-callback`. Hermes defines `window` (and sometimes
 * `window.location`), so never use `window.location` unless
 * `Platform.OS === 'web'`.
 */
export function resolveOAuthCallbackUrl(): string {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location !== undefined
  ) {
    return `${window.location.origin}/sso-callback`;
  }
  return '/sso-callback';
}
