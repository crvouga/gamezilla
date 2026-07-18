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

function isClerkAlreadySignedInError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('already signed in');
}

async function runClerkEnsureSessionReady(): Promise<void> {
  const runtime = getClerkAuthRuntime();
  if (runtime === null) return;
  await runtime.ensureActiveSession();
}

async function startClerkSsoFlow(
  strategy: SignInStrategy
): Promise<SsoFlowResult> {
  const runtime = assertClerkRuntimeReady();
  const clerkStrategy = mapSignInStrategyToClerk(strategy);

  WebBrowser.maybeCompleteAuthSession();
  await runtime.ensureActiveSession();

  return runtime.startSSOFlow({
    strategy: clerkStrategy,
    redirectUrl: AuthSession.makeRedirectUri({ path: 'sso-callback' }),
  });
}

async function runClerkSsoFlow(strategy: SignInStrategy): Promise<void> {
  const runtime = assertClerkRuntimeReady();

  try {
    const result = await startClerkSsoFlow(strategy);
    await finalizeClerkSsoFlowResult(result);
  } catch (error) {
    if (!isClerkAlreadySignedInError(error)) throw error;
    // First sign-in / redirect resume can race; treat as already complete.
    await runtime.ensureActiveSession();
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
      redirectUrl: AuthSession.makeRedirectUri({ path: 'sso-callback' }),
    });
  } catch (error) {
    if (isClerkAlreadySignedInError(error)) {
      throw new Error(CLERK_ADD_ACCOUNT_MULTI_SESSION_ERROR);
    }
    throw error;
  }

  const newSessionId = readNewSessionIdFromSsoResult(result, beforeSessionIds);
  if (newSessionId === null) {
    const completedId = readCompletedSessionId(result);
    if (completedId === null) {
      throw new Error("Sign-in was cancelled or didn't finish.");
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

async function readClerkFreshToken(): Promise<string | null> {
  const runtime = assertClerkRuntimeReady();
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
  };
}
