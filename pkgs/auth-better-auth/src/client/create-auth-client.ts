import { expoClient } from '@better-auth/expo/client';
import type { HttpFetch } from '@pkgs/http-client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import type { AuthClientStorage, BearerTokenStore } from './bearer-token-store';
import { createBearerTokenStore } from './bearer-token-store';

export type BetterAuthReactClient = ReturnType<typeof createAuthClient>;

export type CreateBetterAuthReactClientArgs = {
  readonly baseURL: string;
  /** Custom fetch wired as Better Auth `customFetchImpl` when provided. */
  readonly fetch?: HttpFetch;
  /** expoClient cookie storage; defaults to `expo-secure-store`. */
  readonly storage?: AuthClientStorage;
  /** Bearer store shared with the adapter; an isolated one is made if omitted. */
  readonly bearerStore?: BearerTokenStore;
};

/**
 * Build an isolated Better Auth React client. No process singletons — each call
 * returns a fresh client so multiple in-process actors can coexist. Callers that
 * need to share bearer state (the adapter) pass their own {@link BearerTokenStore}.
 */
export function createBetterAuthReactClient(
  args: CreateBetterAuthReactClientArgs
): BetterAuthReactClient {
  const baseURL = args.baseURL.replace(/\/$/, '');
  const storage: AuthClientStorage = args.storage ?? SecureStore;
  const bearerStore =
    args.bearerStore ??
    createBearerTokenStore(
      args.storage !== undefined ? { storage: args.storage } : undefined
    );

  const customFetchImpl =
    args.fetch !== undefined
      ? (input: RequestInfo | URL, init?: RequestInit) =>
          args.fetch!(input, init)
      : undefined;

  // Injected storage ⇒ isolated actor / test harness. Skip `@better-auth/expo`
  // (it calls `expo-linking` createURL which needs a Constants manifest that
  // Jest does not provide). Bearer capture via `onSuccess` still works.
  const plugins =
    args.storage !== undefined
      ? []
      : [
          expoClient({
            scheme: 'gamezilla',
            storagePrefix: 'gamezilla',
            storage,
          }),
        ];

  return createAuthClient({
    baseURL,
    plugins,
    fetchOptions: {
      ...(customFetchImpl !== undefined ? { customFetchImpl } : {}),
      onSuccess: (ctx) => {
        bearerStore.captureFromResponse(ctx.response);
      },
      // Omit Authorization when signed out — an empty/stale Bearer can be
      // converted back into a session cookie by the server bearer plugin.
      auth: {
        type: 'Bearer',
        token: () => bearerStore.peek() ?? undefined,
      },
    },
  });
}
