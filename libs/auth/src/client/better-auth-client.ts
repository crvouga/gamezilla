import { expoClient } from '@better-auth/expo/client';
import { genericOAuthClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { useMemo } from 'react';
import { APP_IDENTITY } from '../shared/app-identity';

export type AuthClient = ReturnType<typeof createAuthClient>;
export type SessionSnapshot = ReturnType<AuthClient['useSession']>;

/**
 * Resolves the Better Auth handler URL from the configured API origin.
 * Forces `localhost` (not `127.0.0.1`) on local web dev so the Better Auth
 * state cookie persists across the `/sign-in` -> `/callback` redirect.
 */
export function authBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim();
  let origin =
    trimmed.length > 0 ? trimmed.replace(/\/$/, '') : 'http://127.0.0.1:8788';
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    try {
      const u = new URL(origin);
      if (u.hostname === '127.0.0.1') {
        u.hostname = 'localhost';
        origin = u.origin;
      }
    } catch {
      /* keep origin when URL parsing fails */
    }
  }
  return `${origin}/api/auth`;
}

export function useAuthClient(baseURL: string): AuthClient {
  return useMemo(
    () =>
      createAuthClient({
        baseURL,
        plugins: [
          expoClient({
            scheme: APP_IDENTITY.urlScheme,
            storagePrefix: APP_IDENTITY.slug,
            storage: SecureStore,
          }),
          genericOAuthClient(),
        ],
      }),
    [baseURL]
  );
}
