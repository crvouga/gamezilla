import type { Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { IDP_PROVIDER_LABEL } from '../shared/provider-label';
import type {
  SignInCredentials,
  SignInStrategy,
} from '../shared/sign-in-strategy';
import {
  AUTH_NETWORK_ERROR,
  AUTH_SSO_CANCELLED_ERROR,
  apiUrl,
  extractCodeFromCallbackUrl,
  postJson,
  type SessionBody,
  toVerified,
} from './auth-client-http';
import type { AuthClientPort, GetFreshTokenOptions } from './auth-client-port';
import type { AuthSessionState } from './auth-session-state';
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
  /** Required for Google OAuth; unused for Dev social. */
  readonly openAuthSession?: OpenAuthSession;
  /** Absolute client callback URL (e.g. https://app/sso-callback). */
  readonly callbackUrl?: string;
};

export { AUTH_NETWORK_ERROR, AUTH_SSO_CANCELLED_ERROR };

type SessionBus = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly bump: () => void;
};

function createSessionBus(): SessionBus {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    bump() {
      for (const listener of listeners) listener();
    },
  };
}

function useAuthSessionState(args: {
  readonly fetch: HttpFetch;
  readonly baseURL: string;
  readonly bearerStore: BearerTokenStore;
  readonly bus: SessionBus;
}): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    session: null,
    isHydrated: false,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(args.fetch);
  fetchRef.current = args.fetch;

  useEffect(() => args.bus.subscribe(() => setTick((n) => n + 1)), [args.bus]);

  const refresh = useCallback(async () => {
    const token = await args.bearerStore.read();
    if (token === null) {
      setState({ session: null, isHydrated: true, error: null });
      return;
    }
    try {
      const res = await fetchRef.current(
        apiUrl(args.baseURL, '/auth/session'),
        {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        setState({ session: null, isHydrated: true, error: null });
        return;
      }
      const body = (await res.json()) as {
        readonly user?: SessionBody['user'];
        readonly expiresAt?: string;
      };
      const sessionBody: SessionBody = {
        ...(body.user !== undefined ? { user: body.user } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
      };
      setState({
        session: toVerified(sessionBody),
        isHydrated: true,
        error: null,
      });
    } catch (err) {
      setState({
        session: null,
        isHydrated: true,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [args.baseURL, args.bearerStore]);

  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  return state;
}

type SignInCtx = {
  readonly config: AuthClientAdapterConfig;
  readonly bearerStore: BearerTokenStore;
  readonly callbackUrl: string;
  readonly bus: SessionBus;
};

async function persistSessionFromResponse(
  ctx: SignInCtx,
  res: Response
): Promise<void> {
  ctx.bearerStore.captureFromResponse(res);
  if (!res.ok) {
    throw new Error(AUTH_NETWORK_ERROR);
  }
  const body = (await res.json()) as SessionBody;
  if (typeof body.token === 'string' && body.token.length > 0) {
    await ctx.bearerStore.write(body.token);
  }
  ctx.bus.bump();
}

async function exchangeCode(ctx: SignInCtx, code: string): Promise<void> {
  const res = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/session'),
    { code }
  );
  await persistSessionFromResponse(ctx, res);
}

async function signInDev(
  ctx: SignInCtx,
  credentials?: SignInCredentials
): Promise<void> {
  const subject = credentials?.subject?.trim() ?? '';
  if (subject.length === 0) {
    throw new Error('Dev sign-in requires subject');
  }
  await ctx.bearerStore.clear();
  const res = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/oauth/dev/complete'),
    {
      subject,
      name: credentials?.name,
      email: credentials?.email,
    }
  );
  await persistSessionFromResponse(ctx, res);
}

async function signInGoogle(ctx: SignInCtx): Promise<void> {
  if (ctx.config.openAuthSession === undefined) {
    throw new Error('openAuthSession is required for Google OAuth');
  }
  await ctx.bearerStore.clear();
  const startRes = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/oauth/start'),
    { provider: 'google', callbackUrl: ctx.callbackUrl }
  );
  if (!startRes.ok) {
    throw new Error(AUTH_NETWORK_ERROR);
  }
  const startBody = (await startRes.json()) as {
    readonly authorizationUrl?: string;
  };
  if (
    typeof startBody.authorizationUrl !== 'string' ||
    startBody.authorizationUrl.length === 0
  ) {
    throw new Error(AUTH_NETWORK_ERROR);
  }
  const result = await ctx.config.openAuthSession(
    startBody.authorizationUrl,
    ctx.callbackUrl
  );
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
 * (for Google) openAuthSession — no Expo SDK imports in this package.
 */
export function createAuthClientAdapter(
  config: AuthClientAdapterConfig
): AuthClientPort {
  const storage = config.storage ?? createInMemoryAuthClientStorage();
  const bearerStore = config.bearerStore ?? createBearerTokenStore({ storage });
  const callbackUrl = config.callbackUrl ?? 'gamezilla://sso-callback';
  const bus = createSessionBus();
  const ctx: SignInCtx = { config, bearerStore, callbackUrl, bus };

  return {
    providerLabel: IDP_PROVIDER_LABEL,
    useAuthSession: () =>
      useAuthSessionState({
        fetch: config.fetch,
        baseURL: config.baseURL,
        bearerStore,
        bus,
      }),
    async signIn(strategy: SignInStrategy, credentials?: SignInCredentials) {
      if (strategy === 'oauth-dev') {
        await signInDev(ctx, credentials);
        return;
      }
      if (strategy === 'oauth-google') {
        await signInGoogle(ctx);
        return;
      }
      throw new Error(`Unsupported sign-in strategy: ${String(strategy)}`);
    },
    async signOut() {
      bearerStore.setSuppressCapture(true);
      const token = await bearerStore.read();
      bearerStore.clearSync();
      bus.bump();
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
        bus.bump();
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
