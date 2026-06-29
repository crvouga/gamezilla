import { expoClient } from '@better-auth/expo/client';
import { genericOAuthClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { APP_IDENTITY } from '../shared/app-identity';
import { normalizeLoopbackOriginToLocalhost } from '../shared/local-api-origin';

export type AuthClient = ReturnType<typeof createAuthClient>;
export type SessionSnapshot = ReturnType<AuthClient['useSession']>;

/** Survives Suspense remounts — same pattern as `useCachedPromise`. */
const authClientCache = new Map<string, AuthClient>();

/**
 * Resolves the Better Auth handler URL from the configured API origin.
 * Forces `localhost` (not `127.0.0.1`) for local API origins so Better Auth
 * state cookies persist across sign-in, the expo authorization proxy, and the
 * OAuth callback (host-only cookies treat the two loopback hosts as different).
 */
export function authBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim();
  let origin =
    trimmed.length > 0 ? trimmed.replace(/\/$/, '') : 'http://localhost:8788';
  origin = normalizeLoopbackOriginToLocalhost(origin);
  const baseURL = `${origin}/api/auth`;
  return baseURL;
}

/** Construct the shared Better Auth client (at most once per base URL). */
export function createAppAuthClient(baseURL: string): AuthClient {
  const cached = authClientCache.get(baseURL);
  if (cached !== undefined) return cached;
  const client = createAuthClient({
    baseURL,
    plugins: [
      expoClient({
        scheme: APP_IDENTITY.urlScheme,
        storagePrefix: APP_IDENTITY.slug,
        storage: SecureStore,
        webBrowserOptions: { preferEphemeralSession: false },
      }),
      genericOAuthClient(),
    ],
  });
  authClientCache.set(baseURL, client);
  return client;
}
