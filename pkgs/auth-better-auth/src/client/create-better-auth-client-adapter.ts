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
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { BETTER_AUTH_PROVIDER_LABEL } from '../shared/provider-label';
import {
  clearStoredBearerToken,
  clearStoredBearerTokenSync,
  readStoredBearerToken,
  setSuppressBearerCapture,
  writeStoredBearerToken,
} from './bearer-token-store';
import { getOrCreateBetterAuthReactClient } from './create-auth-client';
import {
  BETTER_AUTH_NETWORK_ERROR,
  runEmailPasswordSignIn,
} from './email-password-sign-in';
import { configureAuthBaseURL, readAuthBaseURL } from './read-auth-base-url';
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
};

/** Set by {@link createBetterAuthClientAdapter}; required for delay / sign-out. */
let adapterTimers: Timers | undefined;

export const BETTER_AUTH_SSO_CANCELLED_ERROR =
  "Sign-in was cancelled or didn't finish.";

export { BETTER_AUTH_NETWORK_ERROR };

function client() {
  return getOrCreateBetterAuthReactClient({ baseURL: readAuthBaseURL() });
}

/** Never settles — keep SignInModal loading until the document unloads. */
function waitUntilUnload(): Promise<never> {
  return new Promise(() => undefined);
}

function requireTimers(): Timers {
  assert.defined(adapterTimers, 'Better Auth client adapter not configured');
  return adapterTimers;
}

function delay(ms: number): Promise<void> {
  const timers = requireTimers();
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
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
async function hasUsableBearerSession(): Promise<boolean> {
  const existing = await readStoredBearerToken();
  if (existing === null) return false;
  try {
    const result = await Promise.race([
      client().getSession({
        fetchOptions: {
          headers: { Authorization: `Bearer ${existing}` },
        },
      }),
      delay(EXISTING_SESSION_CHECK_MS).then(() => 'timeout' as const),
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

async function runGoogleOAuthSignIn(): Promise<void> {
  const callbackURL = resolveOAuthCallbackURL();

  if (await hasUsableBearerSession()) {
    return;
  }

  // Stale bearer must not ride along on OAuth cookie establishment (see
  // completeHostedAuthRedirect). Clear before social redirect.
  await clearStoredBearerToken();

  WebBrowser.maybeCompleteAuthSession();

  let result: Awaited<
    ReturnType<ReturnType<typeof client>['signIn']['social']>
  >;
  try {
    result = await client().signIn.social({
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

  if (Platform.OS === 'web') {
    window.location.assign(oauthUrl);
    await Promise.race([
      waitUntilUnload(),
      delay(WEB_REDIRECT_FALLBACK_MS).then(() => {
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
  await completeHostedAuthRedirect();
}

async function runSignIn(
  strategy: SignInStrategy,
  credentials?: SignInCredentials
): Promise<void> {
  if (strategy === 'email-password') {
    assert.defined(credentials, 'email/password credentials required');
    await runEmailPasswordSignIn({
      credentials,
      hasUsableBearerSession,
    });
    return;
  }
  assert.equals(strategy, 'oauth-google', 'Unsupported sign-in strategy', {
    strategy,
  });
  await runGoogleOAuthSignIn();
}

function clearReactSessionAtom(): void {
  const atoms = client().$store.atoms as {
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

async function runSignOut(): Promise<void> {
  // Clear bearer BEFORE sign-out. BA notifies `$sessionSignal` which refetches
  // get-session; if Authorization still carries the old token, the bearer
  // plugin rehydrates the session cookie and the UI stays signed in.
  // Also suppress capture: that refetch can race the cookie clear and briefly
  // re-emit `set-auth-token`. Do NOT await getSession here — it races the
  // signal refetch / AbortController and can hang the Sign out modal forever.
  setSuppressBearerCapture(true);
  clearStoredBearerTokenSync();
  await clearStoredBearerToken();
  try {
    await client().signOut();
  } finally {
    clearStoredBearerTokenSync();
    await clearStoredBearerToken();
    // BA aborts in-flight get-session on signal; settleAbortedFetch keeps the
    // previous signed-in `data`, so the account UI stays logged in. Force-clear.
    clearReactSessionAtom();
    // Allow capture again after BA's deferred session-signal refetch (~10ms).
    requireTimers().setTimeout(() => {
      setSuppressBearerCapture(false);
      clearStoredBearerTokenSync();
      void clearStoredBearerToken();
    }, 250);
  }
}

async function readFreshToken(
  options?: GetFreshTokenOptions
): Promise<string | null> {
  if (options?.skipCache === true) {
    // Explicit refresh only — do not getSession on every empty-cache read
    // (that storms /get-session when signed out and strands isPending).
    await client().getSession();
    return readStoredBearerToken();
  }
  return readStoredBearerToken();
}

async function ensureSessionReady(): Promise<void> {
  await client().getSession();
}

async function completeHostedAuthRedirect(): Promise<void> {
  WebBrowser.maybeCompleteAuthSession();
  // Drop any pre-OAuth bearer first. BA's bearer() hook replaces the request
  // Cookie with Authorization when present — a stale token from localStorage
  // hides the fresh OAuth session cookie and get-session returns null.
  await clearStoredBearerToken();
  // Cookie session was set on the API during `/callback/google`; this call
  // hydrates the React client and captures `set-auth-token` via onSuccess.
  await client().getSession();
  const token = await readStoredBearerToken();
  if (token !== null) {
    await writeStoredBearerToken(token);
  }
}

export function createBetterAuthClientAdapter(
  config: BetterAuthClientAdapterConfig
): AuthClientPort {
  adapterTimers = config.timers;
  configureAuthBaseURL(config.baseURL);
  // OAuth return: browser already has the API session cookie, but a leftover
  // localStorage bearer would be attached on the first useSession get-session
  // and replace that cookie on the server. Clear synchronously first.
  if (isWebSsoCallbackPath()) {
    clearStoredBearerTokenSync();
  }
  // Eagerly create the singleton so hooks share the same client.
  getOrCreateBetterAuthReactClient({ baseURL: readAuthBaseURL() });
  void readStoredBearerToken();

  return {
    providerLabel: BETTER_AUTH_PROVIDER_LABEL,
    useAuthSession: useBetterAuthSessionState,
    signIn: runSignIn,
    signOut: runSignOut,
    getFreshToken: readFreshToken,
    ensureSessionReady,
    completeHostedAuthRedirect,
  };
}
