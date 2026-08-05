import { isClerkRuntimeError } from '@clerk/expo';
import { assert } from '@pkgs/assert';
import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { SignOutOptions } from '@pkgs/auth/client/account-session';
import type { SignInStrategy } from '@pkgs/auth/shared/sign-in-strategy';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { getClerkAuthRuntime } from './clerk-auth-runtime';
import { mapSignInStrategyToClerk } from './clerk-sign-in-strategy';
import {
  finalizeClerkSsoFlowResult,
  readCompletedSessionId,
  readNewSessionIdFromSsoResult,
  type SsoFlowResult,
} from './clerk-sso-finalize';
import { isWebAuthEnvironment } from './is-web-auth-environment';
import { useClerkAccountSessions } from './use-clerk-account-sessions';
import { useClerkAuthSessionState } from './use-clerk-auth-session-state';

export type ClerkAuthClientAdapterConfig = {
  readonly publishableKey: string;
};

/** Clerk rejected a second sign-in (usually multi-session handling is off). */
export const CLERK_ADD_ACCOUNT_MULTI_SESSION_ERROR =
  'Could not keep a second account signed in. Enable Multi-session handling in the Clerk Dashboard (Sessions), save, then try Add account again.';

/** SSO finished on a session that was already present on this client. */
export const CLERK_ADD_ACCOUNT_ALREADY_PRESENT_ERROR =
  'That account is already signed in on this device. Choose a different Google account.';

export const CLERK_SSO_CANCELLED_ERROR =
  "Sign-in was cancelled or didn't finish.";

/** Offline / unreachable — sign-in and add-account need a network. */
export const CLERK_NETWORK_ERROR =
  'No internet connection. Connect and try again.';

function assertClerkRuntimeReady(): NonNullable<
  ReturnType<typeof getClerkAuthRuntime>
> {
  const runtime = getClerkAuthRuntime();
  assert.defined(
    runtime,
    'Clerk auth runtime is not ready — mount ClerkAuthProvider first'
  );
  return runtime;
}

/**
 * Descendant effects flush before {@link ClerkAuthSync}'s publish effect.
 * Yield one microtask so the ancestor can publish, then re-read.
 */
async function waitForClerkRuntime(): Promise<NonNullable<
  ReturnType<typeof getClerkAuthRuntime>
> | null> {
  const immediate = getClerkAuthRuntime();
  if (immediate !== null) return immediate;
  await new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });
  return getClerkAuthRuntime();
}

function isClerkAlreadySignedInError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('already signed in');
}

function isClerkNetworkError(error: unknown): boolean {
  return isClerkRuntimeError(error) && error.code === 'network_error';
}

function throwMappedClerkFlowError(error: unknown): never {
  if (isClerkNetworkError(error)) {
    throw new Error(CLERK_NETWORK_ERROR);
  }
  throw error;
}

function ssoCallbackRedirectUrl(): string {
  return AuthSession.makeRedirectUri({ path: 'sso-callback' });
}

async function runClerkEnsureSessionReady(): Promise<void> {
  const runtime = await waitForClerkRuntime();
  if (runtime === null) return;
  await runtime.ensureActiveSession();
}

async function runClerkCompleteHostedAuthRedirect(): Promise<void> {
  const runtime = await waitForClerkRuntime();
  if (runtime === null) return;
  await runtime.completeHostedAuthRedirect();
}

async function startClerkSsoFlow(
  strategy: SignInStrategy
): Promise<SsoFlowResult> {
  const runtime = assertClerkRuntimeReady();
  const clerkStrategy = mapSignInStrategyToClerk(strategy);
  const redirectUrl = ssoCallbackRedirectUrl();

  WebBrowser.maybeCompleteAuthSession();
  await runtime.ensureActiveSession();

  // Web: same-tab redirect via shared browser flow (avoids popup opener issues).
  // Native: Clerk useSSO + AuthSession.
  if (isWebAuthEnvironment()) {
    return runtime.startBrowserSSOFlow({ redirectUrl });
  }

  return runtime.startSSOFlow({
    strategy: clerkStrategy,
    redirectUrl,
  });
}

async function runClerkSsoFlow(strategy: SignInStrategy): Promise<void> {
  const runtime = assertClerkRuntimeReady();

  try {
    const result = await startClerkSsoFlow(strategy);
    if (readCompletedSessionId(result) === null) {
      throw new Error(CLERK_SSO_CANCELLED_ERROR);
    }
    await finalizeClerkSsoFlowResult(result);
  } catch (error) {
    if (isClerkAlreadySignedInError(error)) {
      // First sign-in / redirect resume can race; treat as already complete.
      await runtime.ensureActiveSession();
      return;
    }
    throwMappedClerkFlowError(error);
  }
}

async function runClerkSignIn(strategy: SignInStrategy): Promise<void> {
  const runtime = assertClerkRuntimeReady();
  await runtime.ensureActiveSession();

  const existingToken = await runtime.getToken();
  if (existingToken !== null) return;

  await runClerkSsoFlow(strategy);
}

async function runClerkAddAccount(strategy: SignInStrategy): Promise<void> {
  const runtime = assertClerkRuntimeReady();
  const clerkStrategy = mapSignInStrategyToClerk(strategy);
  const beforeSessionIds = new Set(
    runtime.listSessions().map((session) => session.id)
  );
  const beforeCount = beforeSessionIds.size;

  WebBrowser.maybeCompleteAuthSession();
  await runtime.ensureActiveSession();

  let result: SsoFlowResult;
  try {
    result = await runtime.startAddAccountSSOFlow({
      strategy: clerkStrategy,
      redirectUrl: ssoCallbackRedirectUrl(),
    });
  } catch (error) {
    if (isClerkAlreadySignedInError(error)) {
      throw new Error(CLERK_ADD_ACCOUNT_MULTI_SESSION_ERROR);
    }
    throwMappedClerkFlowError(error);
  }

  const newSessionId = readNewSessionIdFromSsoResult(result, beforeSessionIds);
  if (newSessionId === null) {
    const completedId = readCompletedSessionId(result);
    if (completedId === null) {
      throw new Error(CLERK_SSO_CANCELLED_ERROR);
    }
    throw new Error(CLERK_ADD_ACCOUNT_ALREADY_PRESENT_ERROR);
  }

  await runtime.setActive({ session: newSessionId });

  const afterCount = runtime.listSessions().length;
  if (afterCount <= beforeCount) {
    throw new Error(CLERK_ADD_ACCOUNT_MULTI_SESSION_ERROR);
  }
}

async function runClerkSwitchAccount(sessionId: string): Promise<void> {
  const runtime = assertClerkRuntimeReady();
  assert.nonEmptyString(sessionId, 'sessionId');
  await runtime.setActive({ session: sessionId });
}

async function activateFallbackSession(
  runtime: NonNullable<ReturnType<typeof getClerkAuthRuntime>>,
  removedSessionId: string
): Promise<void> {
  const next = runtime
    .listSessions()
    .find((session) => session.id !== removedSessionId);
  if (next === undefined) return;
  await runtime.setActive({ session: next.id });
}

async function runClerkSignOut(options?: SignOutOptions): Promise<void> {
  const runtime = assertClerkRuntimeReady();
  const scope = options?.scope ?? 'active';

  if (scope === 'all') {
    await runtime.signOut();
    return;
  }

  const activeSessionId = runtime.getActiveSessionId();
  if (activeSessionId === null) {
    await runtime.signOut();
    return;
  }

  await runtime.signOut({ sessionId: activeSessionId });
  await activateFallbackSession(runtime, activeSessionId);
}

async function readClerkFreshToken(options?: {
  readonly skipCache?: boolean;
}): Promise<string | null> {
  // Null while ClerkAuthSync has not published yet (descendant effects run
  // first) or during Strict Mode remount — callers treat null as unsigned.
  const runtime = await waitForClerkRuntime();
  if (runtime === null) return null;
  if (options?.skipCache === true) {
    return runtime.getToken({ skipCache: true });
  }
  return runtime.getToken();
}

export function createClerkAuthClientAdapter(
  _config: ClerkAuthClientAdapterConfig
): AuthClientPort {
  return {
    providerLabel: 'clerk',
    useAuthSession: useClerkAuthSessionState,
    useAccountSessions: useClerkAccountSessions,
    signIn: runClerkSignIn,
    addAccount: runClerkAddAccount,
    switchAccount: runClerkSwitchAccount,
    signOut: runClerkSignOut,
    getFreshToken: readClerkFreshToken,
    ensureSessionReady: runClerkEnsureSessionReady,
    completeHostedAuthRedirect: runClerkCompleteHostedAuthRedirect,
  };
}
