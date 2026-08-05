import { isClerkRuntimeError } from '@clerk/expo';
import { assert } from '@pkgs/assert';
import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { SignInStrategy } from '@pkgs/auth/shared/sign-in-strategy';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { getClerkAuthRuntime } from './clerk-auth-runtime';
import { mapSignInStrategyToClerk } from './clerk-sign-in-strategy';
import {
  finalizeClerkSsoFlowResult,
  readCompletedSessionId,
  type SsoFlowResult,
} from './clerk-sso-finalize';
import { isWebAuthEnvironment } from './is-web-auth-environment';
import { useClerkAuthSessionState } from './use-clerk-auth-session-state';

export type ClerkAuthClientAdapterConfig = {
  readonly publishableKey: string;
};

export const CLERK_SSO_CANCELLED_ERROR =
  "Sign-in was cancelled or didn't finish.";

/** Offline / unreachable — sign-in needs a network. */
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

async function runClerkSignOut(): Promise<void> {
  const runtime = assertClerkRuntimeReady();
  await runtime.signOut();
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
    signIn: runClerkSignIn,
    signOut: runClerkSignOut,
    getFreshToken: readClerkFreshToken,
    ensureSessionReady: runClerkEnsureSessionReady,
    completeHostedAuthRedirect: runClerkCompleteHostedAuthRedirect,
  };
}
