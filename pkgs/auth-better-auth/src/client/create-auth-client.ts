import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import {
  captureBearerFromResponse,
  peekBearerToken,
} from './bearer-token-store';

export type BetterAuthReactClient = ReturnType<typeof createAuthClient>;

let singleton: BetterAuthReactClient | null = null;
let singletonBaseURL: string | null = null;

export function getOrCreateBetterAuthReactClient(args: {
  readonly baseURL: string;
}): BetterAuthReactClient {
  const baseURL = args.baseURL.replace(/\/$/, '');
  if (singleton !== null && singletonBaseURL === baseURL) {
    return singleton;
  }
  singletonBaseURL = baseURL;
  singleton = createAuthClient({
    baseURL,
    plugins: [
      expoClient({
        scheme: 'gamezilla',
        storagePrefix: 'gamezilla',
        storage: SecureStore,
      }),
    ],
    fetchOptions: {
      onSuccess: (ctx) => {
        captureBearerFromResponse(ctx.response);
      },
      // Omit Authorization when signed out — an empty/stale Bearer can be
      // converted back into a session cookie by the server bearer plugin.
      auth: {
        type: 'Bearer',
        token: () => peekBearerToken() ?? undefined,
      },
    },
  });
  return singleton;
}
