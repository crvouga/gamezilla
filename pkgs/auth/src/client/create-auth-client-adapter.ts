import type { Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';

import { IDP_PROVIDER_LABEL } from '../shared/provider-label';
import type {
  SignInCredentials,
  SignInStrategy,
} from '../shared/sign-in-strategy';
import {
  AUTH_NETWORK_ERROR,
  AUTH_SSO_CANCELLED_ERROR,
  AUTH_SSO_POPUP_BLOCKED_ERROR,
  apiUrl,
  buildOauthLaunchUrl,
  extractCodeFromCallbackUrl,
  isPopupBlockedError,
  postJson,
  type SessionBody,
  strategyToOauthProvider,
  toVerified,
} from './auth-client-http';
import type { AuthClientPort, GetFreshTokenOptions } from './auth-client-port';
import {
  AUTH_SESSION_INITIAL,
  type AuthSessionState,
  type AuthSessionStore,
} from './auth-session-state';
import {
  type AuthClientStorage,
  type BearerTokenStore,
  createBearerTokenStore,
  createInMemoryAuthClientStorage,
} from './bearer-token-store';

export type OpenAuthSessionResult = {
  readonly type: 'success' | 'cancel' | 'dismiss' | 'locked';
  readonly url?: string | null;
};

export type OpenAuthSession = (
  authorizationUrl: string,
  callbackUrl: string
) => Promise<OpenAuthSessionResult>;

export type AuthClientAdapterConfig = {
  readonly baseURL: string;
  readonly timers: Timers;
  readonly fetch: HttpFetch;
  readonly storage?: AuthClientStorage;
  readonly bearerStore?: BearerTokenStore;
  /** Required for OAuth providers; unused only when every strategy is stubbed. */
  readonly openAuthSession?: OpenAuthSession;
  /** Absolute client callback URL (e.g. https://app/sso-callback). */
  readonly callbackUrl?: string;
};

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
    };
    const sessionBody: SessionBody = {
      ...(body.user !== undefined ? { user: body.user } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
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
}): AuthSessionStore {
  const listeners = new Set<() => void>();
  let state: AuthSessionState = AUTH_SESSION_INITIAL;
  let generation = 0;
  const publish = (next: AuthSessionState): void => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
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
      if (mine === generation) publish(next);
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

type SignInCtx = {
  readonly config: AuthClientAdapterConfig;
  readonly bearerStore: BearerTokenStore;
  readonly callbackUrl: string;
  readonly session: AuthSessionStore;
};

async function persistSessionFromResponse(
  ctx: SignInCtx,
  res: Response
): Promise<void> {
  ctx.bearerStore.captureFromResponse(res);
  if (!res.ok) {
    throw new Error(await signInHttpFailureMessage(res));
  }
  const body = (await res.json()) as SessionBody;
  if (typeof body.token === 'string' && body.token.length > 0) {
    await ctx.bearerStore.write(body.token);
  }
  await ctx.session.refresh();
}

async function signInHttpFailureMessage(res: Response): Promise<string> {
  let detail = '';
  try {
    const text = (await res.text()).trim();
    if (text.length > 0) {
      detail = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    }
  } catch {
    // ignore body read failures
  }
  if (detail.length > 0) {
    return `${AUTH_NETWORK_ERROR} (${String(res.status)}: ${detail})`;
  }
  return `${AUTH_NETWORK_ERROR} (${String(res.status)})`;
}

async function exchangeCode(ctx: SignInCtx, code: string): Promise<void> {
  const res = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/session'),
    { code }
  );
  await persistSessionFromResponse(ctx, res);
}

async function signInOauth(
  ctx: SignInCtx,
  strategy: SignInStrategy
): Promise<void> {
  if (ctx.config.openAuthSession === undefined) {
    throw new Error('openAuthSession is required for OAuth sign-in');
  }
  const provider = strategyToOauthProvider(strategy);
  const launchUrl = buildOauthLaunchUrl(
    ctx.config.baseURL,
    provider,
    ctx.callbackUrl
  );

  // Open the auth session synchronously from the user gesture — no await first.
  let sessionPromise: Promise<OpenAuthSessionResult>;
  try {
    sessionPromise = ctx.config.openAuthSession(launchUrl, ctx.callbackUrl);
  } catch (err) {
    if (isPopupBlockedError(err)) {
      throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
    }
    throw err;
  }

  await ctx.bearerStore.clear();

  let result: OpenAuthSessionResult;
  try {
    result = await sessionPromise;
  } catch (err) {
    if (isPopupBlockedError(err)) {
      throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
    }
    throw err;
  }

  if (result.type !== 'success' || result.url == null) {
    throw new Error(AUTH_SSO_CANCELLED_ERROR);
  }
  const code = extractCodeFromCallbackUrl(result.url);
  if (code === null) {
    throw new Error(AUTH_SSO_CANCELLED_ERROR);
  }
  await exchangeCode(ctx, code);
}

/**
 * Isomorphic AuthClientPort. Hosts inject fetch, storage, timers, and
 * openAuthSession — no platform SDK imports in this package.
 */
export function createAuthClientAdapter(
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

  return {
    providerLabel: IDP_PROVIDER_LABEL,
    session,
    async signIn(strategy: SignInStrategy, _credentials?: SignInCredentials) {
      if (strategy === 'oauth-dev' || strategy === 'oauth-google') {
        await signInOauth(ctx, strategy);
        return;
      }
      throw new Error(`Unsupported sign-in strategy: ${String(strategy)}`);
    },
    async signOut() {
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
    },
    async getFreshToken(_options?: GetFreshTokenOptions) {
      return bearerStore.read();
    },
    async ensureSessionReady() {
      // no-op: bearer store is the session source
    },
    async completeHostedAuthRedirect() {
      if (typeof globalThis.location === 'undefined') return;
      const code = extractCodeFromCallbackUrl(globalThis.location.href);
      if (code === null) return;
      await exchangeCode(ctx, code);
    },
  };
}
