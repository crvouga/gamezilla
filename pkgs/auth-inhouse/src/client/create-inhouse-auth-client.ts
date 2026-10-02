import type { AuthClientPort, GetFreshTokenOptions } from '@pkgs/auth/client';
import {
  AUTH_SESSION_INITIAL,
  type AuthSessionState,
  type AuthSessionStore,
} from '@pkgs/auth/client';
import type { HttpFetch } from '@pkgs/http-client';
import { IDP_PROVIDER_LABEL } from '../shared/provider-label';
import {
  AUTH_NETWORK_ERROR,
  AUTH_SSO_CANCELLED_ERROR,
  AUTH_SSO_POPUP_BLOCKED_ERROR,
  apiUrl,
  postJson,
  type SessionBody,
  toVerified,
} from './auth-client-http';
import type { LinkingOps } from './auth-client-linking';
import {
  type AuthClientAdapterConfig,
  codeOrThrow,
  exchangeCode,
  type SignInCtx,
  signInOauth,
} from './auth-client-oauth';
import { readCallbackOutcome } from './auth-errors';
import {
  type BearerTokenStore,
  createBearerTokenStore,
  createInMemoryAuthClientStorage,
} from './bearer-token-store';

export {
  AUTH_NETWORK_ERROR,
  AUTH_SSO_CANCELLED_ERROR,
  AUTH_SSO_POPUP_BLOCKED_ERROR,
};

/** Verify the stored bearer against `/auth/session`; null when absent / dead. */
async function loadSessionState(args: {
  readonly fetch: HttpFetch;
  readonly baseURL: string;
  readonly bearerStore: BearerTokenStore;
}): Promise<AuthSessionState> {
  const token = await args.bearerStore.read();
  if (token === null) {
    return { session: null, isHydrated: true, error: null };
  }
  try {
    const res = await args.fetch(apiUrl(args.baseURL, '/auth/session'), {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      await clearBearerOnUnauthorizedSession(args.bearerStore, res.status);
      return { session: null, isHydrated: true, error: null };
    }
    const body = (await res.json()) as {
      readonly user?: SessionBody['user'];
      readonly expiresAt?: string;
      readonly authenticatedAt?: string;
    };
    const sessionBody: SessionBody = {
      ...(body.user !== undefined ? { user: body.user } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
      ...(body.authenticatedAt !== undefined
        ? { authenticatedAt: body.authenticatedAt }
        : {}),
    };
    return { session: toVerified(sessionBody), isHydrated: true, error: null };
  } catch (err) {
    return {
      session: null,
      isHydrated: true,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Framework-free session store. `refresh()` calls overlap-safe: the newest
 * request wins, stale responses are dropped, so a sign-out that lands while a
 * verify is in flight never resurrects the old session.
 */
function createAuthSessionStore(args: {
  readonly fetch: HttpFetch;
  readonly baseURL: string;
  readonly bearerStore: BearerTokenStore;
}): AuthSessionStore & { fail(error: Error): void } {
  const listeners = new Set<() => void>();
  let state: AuthSessionState = AUTH_SESSION_INITIAL;
  let generation = 0;
  const publish = (next: AuthSessionState): void => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    fail(error) {
      generation += 1;
      publish({ session: null, isHydrated: true, error });
    },
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async refresh() {
      generation += 1;
      const mine = generation;
      const next = await loadSessionState(args);
      if (mine !== generation) return;
      // Not being able to ask is not an answer: a network error keeps the
      // session we had (and wakes nobody), or going offline would sign the
      // device out.
      if (next.error !== null && state.session !== null) return;
      publish(next);
    },
  };
}

/**
 * Drop a dead IdP bearer after `/auth/session` rejects it. Sync
 * {@link AuthClientPort.getFreshToken} reads this store — leaving a 401'd token
 * poisons `/api/query` and blocks `client_config` hydrate (sign-in methods).
 */
export async function clearBearerOnUnauthorizedSession(
  bearerStore: BearerTokenStore,
  status: number
): Promise<void> {
  if (status === 401 || status === 403) {
    await bearerStore.clear();
  }
}

/**
 * Isomorphic AuthClientPort. Hosts inject fetch, storage, timers, and
 * openAuthSession — no platform SDK imports in this package.
 */
export function createInhouseAuthClient(
  config: AuthClientAdapterConfig
): AuthClientPort {
  const storage = config.storage ?? createInMemoryAuthClientStorage();
  const bearerStore = config.bearerStore ?? createBearerTokenStore({ storage });
  const callbackUrl = config.callbackUrl ?? 'gamezilla://sso-callback';
  const session = createAuthSessionStore({
    fetch: config.fetch,
    baseURL: config.baseURL,
    bearerStore,
  });
  const ctx: SignInCtx = { config, bearerStore, callbackUrl, session };
  // Managing sign-in methods (Settings, link prompts) is off the boot path:
  // load it on first use. `prepareLink` runs ahead of the tap, so the module
  // is already resolved when `linkProvider` opens the popup.
  let linkingOps: Promise<LinkingOps> | null = null;
  const linking = (): Promise<LinkingOps> => {
    linkingOps ??= import('./auth-client-linking').then((m) =>
      m.createLinkingOps(ctx, config.clock)
    );
    return linkingOps;
  };

  const signOut = async (): Promise<void> => {
    bearerStore.setSuppressCapture(true);
    const token = await bearerStore.read();
    bearerStore.clearSync();
    await session.refresh();
    try {
      if (token !== null) {
        await postJson(
          config.fetch,
          apiUrl(config.baseURL, '/auth/sign-out'),
          {},
          token
        );
      }
    } finally {
      await bearerStore.clear();
      await session.refresh();
      config.timers.setTimeout(() => {
        bearerStore.setSuppressCapture(false);
      }, 500);
    }
  };

  return {
    provider: IDP_PROVIDER_LABEL,
    session,
    async signIn(provider, options) {
      await signInOauth(ctx, provider, options);
    },
    signOut,
    async signOutEverywhere() {
      await (await linking()).signOutEverywhere();
      await signOut();
    },
    listIdentities: async () => (await linking()).listIdentities(),
    prepareLink: async () => (await linking()).prepareLink(),
    linkProvider: async (provider) => (await linking()).linkProvider(provider),
    unlinkProvider: async (provider) =>
      (await linking()).unlinkProvider(provider),
    createSeparateAccount: async (pendingLinkToken) =>
      (await linking()).createSeparateAccount(pendingLinkToken),
    async getFreshToken(options?: GetFreshTokenOptions) {
      // After a 401 the caller asks for a fresh token: re-check the session,
      // which drops a bearer the server no longer honours.
      if (options?.skipCache === true) await session.refresh();
      return bearerStore.read();
    },
    async completeHostedAuthRedirect() {
      if (typeof globalThis.location === 'undefined') return;
      const outcome = readCallbackOutcome(globalThis.location.href);
      try {
        const code = codeOrThrow(outcome);
        const previous = await bearerStore.read();
        await exchangeCode(ctx, code);
        // Linking preserves the bearer across navigation; retire the session
        // the callback replaced, just as the in-process linking flow does.
        if (previous !== null && previous !== (await bearerStore.read())) {
          await postJson(
            config.fetch,
            apiUrl(config.baseURL, '/auth/sign-out'),
            {},
            previous
          );
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        session.fail(error);
        throw error;
      }
    },
  };
}
