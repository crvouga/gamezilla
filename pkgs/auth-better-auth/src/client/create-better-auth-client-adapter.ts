import { assert } from '@pkgs/assert';
import type {
  AuthClientPort,
  GetFreshTokenOptions,
} from '@pkgs/auth/client/auth-client-port';
import type {
  SignInCredentials,
  SignInStrategy,
} from '@pkgs/auth/shared/sign-in-strategy';
import type { Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { BETTER_AUTH_PROVIDER_LABEL } from '../shared/provider-label';
import type { AuthClientStorage, BearerTokenStore } from './bearer-token-store';
import { createBearerTokenStore } from './bearer-token-store';
import type { BetterAuthReactClient } from './create-auth-client';
import { createBetterAuthReactClient } from './create-auth-client';
import {
  BETTER_AUTH_NETWORK_ERROR,
  runEmailPasswordSignIn,
} from './email-password-sign-in';
import { useBetterAuthSessionState } from './use-better-auth-session-state';

/** True on the web OAuth return route — clear stale bearer before first fetch. */
function isWebSsoCallbackPath(): boolean {
  if (Platform.OS !== 'web') return false;
  const path = globalThis.location?.pathname ?? '';
  return path === '/sso-callback' || path.endsWith('/sso-callback');
}

export type BetterAuthClientAdapterConfig = {
  readonly baseURL: string;
  readonly timers: Timers;
  /** Custom fetch wired as Better Auth `customFetchImpl` when provided. */
  readonly fetch?: HttpFetch;
  /** expoClient cookie storage; defaults to `expo-secure-store`. */
  readonly storage?: AuthClientStorage;
  /** Bearer store to reuse; an isolated one is created when omitted. */
  readonly bearerStore?: BearerTokenStore;
};

/** Per-adapter instance state (no module singletons). */
type AdapterContext = {
  readonly client: BetterAuthReactClient;
  readonly bearerStore: BearerTokenStore;
  readonly timers: Timers;
};

export const BETTER_AUTH_SSO_CANCELLED_ERROR =
  "Sign-in was cancelled or didn't finish.";

export { BETTER_AUTH_NETWORK_ERROR };

/** Never settles — keep SignInModal loading until the document unloads. */
function waitUntilUnload(): Promise<never> {
  return new Promise(() => undefined);
}

function delay(ctx: AdapterContext, ms: number): Promise<void> {
  return new Promise((resolve) => {
    ctx.timers.setTimeout(resolve, ms);
  });
}

/** Cap so a stuck getSession cannot block Google OAuth forever. */
const EXISTING_SESSION_CHECK_MS = 2500;
/** If location.assign does not unload, surface an error instead of hanging. */
const WEB_REDIRECT_FALLBACK_MS = 10_000;

/**
 * True when a stored bearer still maps to a live session. Times out so a
 * wrangler/AbortController pile-up cannot strand SignInModal on "Signing in…".
 */
async function hasUsableBearerSession(ctx: AdapterContext): Promise<boolean> {
  const existing = await ctx.bearerStore.read();
  if (existing === null) return false;
  try {
    const result = await Promise.race([
      ctx.client.getSession({
        fetchOptions: {
          headers: { Authorization: `Bearer ${existing}` },
        },
      }),
      delay(ctx, EXISTING_SESSION_CHECK_MS).then(() => 'timeout' as const),
    ]);
    if (result === 'timeout') return false;
    return result.data !== null && result.data !== undefined;
  } catch {
    return false;
  }
}

function resolveOAuthCallbackURL(): string {
  if (Platform.OS === 'web') {
    const origin = globalThis.location?.origin?.replace(/\/$/, '') ?? '';
    assert.nonEmptyString(origin, 'window.location.origin required for OAuth');
    // Must be absolute — relative `/sso-callback` resolves on the API host
    // after Google returns (`localhost:8788/sso-callback` → 404).
    const absolute = new URL('/sso-callback', `${origin}/`).href;
    assert.ok(
      absolute.startsWith('http://') || absolute.startsWith('https://'),
      'OAuth callbackURL must be an absolute http(s) URL on web'
    );
    return absolute;
  }
  // Matches expoClient({ scheme: 'gamezilla' }) in create-auth-client.
  return 'gamezilla://sso-callback';
}

function readSocialRedirectUrl(data: unknown): string | null {
  if (data === null || data === undefined || typeof data !== 'object') {
    return null;
  }
  const url = (data as { url?: unknown }).url;
  return typeof url === 'string' && url.trim().length > 0 ? url.trim() : null;
}

function throwAuthClientError(error: unknown): never {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'Sign-in failed';
  if (/network|fetch|offline/i.test(message)) {
    throw new Error(BETTER_AUTH_NETWORK_ERROR);
  }
  throw new Error(message);
}

async function requestSocialSignIn(
  ctx: AdapterContext,
  callbackURL: string
): Promise<string> {
  let result: Awaited<ReturnType<BetterAuthReactClient['signIn']['social']>>;
  try {
    result = await ctx.client.signIn.social({
      provider: 'google',
      callbackURL,
      disableRedirect: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/network|fetch|offline/i.test(message)) {
      throw new Error(BETTER_AUTH_NETWORK_ERROR);
    }
    throw error;
  }
  if (result.error !== null && result.error !== undefined) {
    throwAuthClientError(result.error);
  }
  const oauthUrl = readSocialRedirectUrl(result.data);
  assert.ok(oauthUrl !== null, 'Better Auth social sign-in returned no URL');
  return oauthUrl;
}

async function runGoogleOAuthSignIn(ctx: AdapterContext): Promise<void> {
  const callbackURL = resolveOAuthCallbackURL();

  if (await hasUsableBearerSession(ctx)) {
    return;
  }

  // Stale bearer must not ride along on OAuth cookie establishment (see
  // completeHostedAuthRedirect). Clear before social redirect.
  await ctx.bearerStore.clear();

  WebBrowser.maybeCompleteAuthSession();

  const oauthUrl = await requestSocialSignIn(ctx, callbackURL);

  if (Platform.OS === 'web') {
    window.location.assign(oauthUrl);
    await Promise.race([
      waitUntilUnload(),
      delay(ctx, WEB_REDIRECT_FALLBACK_MS).then(() => {
        throw new Error(
          'Redirect to Google did not start. Check blockers and try again.'
        );
      }),
    ]);
    return;
  }

  const authSession = await WebBrowser.openAuthSessionAsync(
    oauthUrl,
    callbackURL
  );
  if (authSession.type !== 'success') {
    throw new Error(BETTER_AUTH_SSO_CANCELLED_ERROR);
  }
  await completeHostedAuthRedirect(ctx);
}

async function runSignIn(
  ctx: AdapterContext,
  strategy: SignInStrategy,
  credentials?: SignInCredentials
): Promise<void> {
  if (strategy === 'email-password') {
    assert.defined(credentials, 'email/password credentials required');
    await runEmailPasswordSignIn({
      client: ctx.client,
      bearerStore: ctx.bearerStore,
      credentials,
      hasUsableBearerSession: () => hasUsableBearerSession(ctx),
    });
    return;
  }
  assert.equals(strategy, 'oauth-google', 'Unsupported sign-in strategy', {
    strategy,
  });
  await runGoogleOAuthSignIn(ctx);
}

function clearReactSessionAtom(ctx: AdapterContext): void {
  const atoms = ctx.client.$store.atoms as {
    session?: {
      get: () => {
        data: unknown;
        error: unknown;
        isPending: boolean;
        isRefetching: boolean;
        refetch: (queryParams?: { query?: Record<string, string> }) => void;
      };
      set: (value: {
        data: null;
        error: null;
        isPending: boolean;
        isRefetching: boolean;
        refetch: (queryParams?: { query?: Record<string, string> }) => void;
      }) => void;
    };
  };
  const sessionAtom = atoms.session;
  if (sessionAtom === undefined) return;
  const current = sessionAtom.get();
  sessionAtom.set({
    data: null,
    error: null,
    isPending: false,
    isRefetching: false,
    refetch: current.refetch,
  });
}

async function runSignOut(ctx: AdapterContext): Promise<void> {
  // Clear bearer BEFORE sign-out. BA notifies `$sessionSignal` which refetches
  // get-session; if Authorization still carries the old token, the bearer
  // plugin rehydrates the session cookie and the UI stays signed in.
  // Also suppress capture: that refetch can race the cookie clear and briefly
  // re-emit `set-auth-token`. Do NOT await getSession here — it races the
  // signal refetch / AbortController and can hang the Sign out modal forever.
  ctx.bearerStore.setSuppressCapture(true);
  ctx.bearerStore.clearSync();
  await ctx.bearerStore.clear();
  try {
    await ctx.client.signOut();
  } finally {
    ctx.bearerStore.clearSync();
    await ctx.bearerStore.clear();
    // BA aborts in-flight get-session on signal; settleAbortedFetch keeps the
    // previous signed-in `data`, so the account UI stays logged in. Force-clear.
    clearReactSessionAtom(ctx);
    // Allow capture again after BA's deferred session-signal refetch (~10ms).
    ctx.timers.setTimeout(() => {
      ctx.bearerStore.setSuppressCapture(false);
      ctx.bearerStore.clearSync();
      void ctx.bearerStore.clear();
    }, 250);
  }
}

/**
 * Ceremony mint paths only. Steady-state product chrome must not call
 * getSession — it reads secure-storage `sessionToken` instead.
 */
async function readFreshToken(
  ctx: AdapterContext,
  options?: GetFreshTokenOptions
): Promise<string | null> {
  if (options?.skipCache === true) {
    // Explicit refresh only — do not getSession on every empty-cache read
    // (that storms /get-session when signed out and strands isPending).
    await ctx.client.getSession();
    return ctx.bearerStore.read();
  }
  return ctx.bearerStore.read();
}

async function ensureSessionReady(ctx: AdapterContext): Promise<void> {
  await ctx.client.getSession();
}

async function completeHostedAuthRedirect(ctx: AdapterContext): Promise<void> {
  WebBrowser.maybeCompleteAuthSession();
  // Drop any pre-OAuth bearer first. BA's bearer() hook replaces the request
  // Cookie with Authorization when present — a stale token from localStorage
  // hides the fresh OAuth session cookie and get-session returns null.
  await ctx.bearerStore.clear();
  // Cookie session was set on the API during `/callback/google`; this call
  // hydrates the React client and captures `set-auth-token` via onSuccess.
  await ctx.client.getSession();
  const token = await ctx.bearerStore.read();
  if (token !== null) {
    await ctx.bearerStore.write(token);
  }
}

/**
 * Better Auth adapter: sign-in/out + token mint. `useAuthSession` is for
 * AuthBridge reconcile only — not product chrome.
 *
 * Each call builds an isolated React client + bearer store (no process
 * singletons), so multiple in-process actors can each hold their own adapter.
 */
export function createBetterAuthClientAdapter(
  config: BetterAuthClientAdapterConfig
): AuthClientPort {
  const bearerStore =
    config.bearerStore ??
    createBearerTokenStore(
      config.storage !== undefined ? { storage: config.storage } : undefined
    );
  const client = createBetterAuthReactClient({
    baseURL: config.baseURL,
    ...(config.fetch !== undefined ? { fetch: config.fetch } : {}),
    ...(config.storage !== undefined ? { storage: config.storage } : {}),
    bearerStore,
  });
  const ctx: AdapterContext = { client, bearerStore, timers: config.timers };

  // OAuth return: browser already has the API session cookie, but a leftover
  // localStorage bearer would be attached on the first useSession get-session
  // and replace that cookie on the server. Clear synchronously first.
  if (isWebSsoCallbackPath()) {
    bearerStore.clearSync();
  }
  void bearerStore.read();

  return {
    providerLabel: BETTER_AUTH_PROVIDER_LABEL,
    useAuthSession: () => useBetterAuthSessionState({ client, bearerStore }),
    signIn: (strategy, credentials) => runSignIn(ctx, strategy, credentials),
    signOut: () => runSignOut(ctx),
    getFreshToken: (options) => readFreshToken(ctx, options),
    ensureSessionReady: () => ensureSessionReady(ctx),
    completeHostedAuthRedirect: () => completeHostedAuthRedirect(ctx),
  };
}
