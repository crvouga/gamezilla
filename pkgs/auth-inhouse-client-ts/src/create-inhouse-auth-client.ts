import type { BearerTokenStore } from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import { IDP_PROVIDER_LABEL } from '@pkgs/auth-inhouse-shared-ts/provider-label';
import type {
  AuthClientPort,
  GetFreshTokenOptions,
} from '@pkgs/auth-root-shared-ts/auth-client-port';
import type {
  AuthSessionState,
  AuthSessionStore,
} from '@pkgs/auth-root-shared-ts/auth-session-state';
import { AUTH_SESSION_INITIAL } from '@pkgs/auth-root-shared-ts/auth-session-state';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import type { SessionBody } from './auth-client-http';
import { apiUrl, postJson, toVerified } from './auth-client-http';
import { createLinkingOps } from './auth-client-linking';
import type { AuthClientAdapterConfig, SignInCtx } from './auth-client-oauth';
import { codeOrThrow, exchangeCode, signInOauth } from './auth-client-oauth';
import { readCallbackOutcome } from './auth-errors';
import {
  emailLinkTokenIn,
  requestEmailLink,
  retireReplacedSession,
  signInWithEmailLink,
} from './email-link-auth-client';

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
  const { bearerStore, callbackUrl } = config;
  const session = createAuthSessionStore({
    fetch: config.fetch,
    baseURL: config.baseURL,
    bearerStore,
  });
  const ctx: SignInCtx = { config, bearerStore, callbackUrl, session };
  const linkingOps = createLinkingOps(ctx, config.clock);

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
    requestEmailLink: (email, options) => requestEmailLink(ctx, email, options),
    signInWithEmailLink: (link) => signInWithEmailLink(ctx, link),
    async signIn(provider, options) {
      await signInOauth(ctx, provider, options);
    },
    signOut,
    async signOutEverywhere() {
      await linkingOps.signOutEverywhere();
      await signOut();
    },
    listIdentities: async () => linkingOps.listIdentities(),
    prepareLink: async () => linkingOps.prepareLink(),
    linkProvider: async (provider) => linkingOps.linkProvider(provider),
    unlinkProvider: async (provider) => linkingOps.unlinkProvider(provider),
    createSeparateAccount: async (pendingLinkToken) =>
      linkingOps.createSeparateAccount(pendingLinkToken),
    async getFreshToken(options?: GetFreshTokenOptions) {
      // After a 401 the caller asks for a fresh token: re-check the session,
      // which drops a bearer the server no longer honours.
      if (options?.skipCache === true) await session.refresh();
      return bearerStore.read();
    },
    async completeHostedAuthRedirect() {
      if (typeof globalThis.location === 'undefined') return;
      const href = globalThis.location.href;
      try {
        // An emailed link opens this route carrying its token, not a code.
        if (emailLinkTokenIn(href) !== null) {
          await signInWithEmailLink(ctx, href);
          return;
        }
        const code = codeOrThrow(readCallbackOutcome(href));
        const previous = await bearerStore.read();
        await exchangeCode(ctx, code);
        // Linking preserves the bearer across navigation; retire the session
        // the callback replaced, just as the in-process linking flow does.
        await retireReplacedSession(ctx, previous);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        session.fail(error);
        throw error;
      }
    },
  };
}
