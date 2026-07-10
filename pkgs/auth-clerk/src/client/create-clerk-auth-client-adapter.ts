import { assert } from '@pkgs/assert';
import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { SignInStrategy } from '@pkgs/auth/shared/sign-in-strategy';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { getClerkAuthRuntime } from './clerk-auth-runtime';
import { mapSignInStrategyToClerk } from './clerk-sign-in-strategy';
import { finalizeClerkSsoFlowResult } from './clerk-sso-finalize';
import { useClerkAuthSessionState } from './use-clerk-auth-session-state';

export type ClerkAuthClientAdapterConfig = {
  readonly publishableKey: string;
};

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

async function runClerkSignIn(strategy: SignInStrategy): Promise<void> {
  const runtime = assertClerkRuntimeReady();
  const clerkStrategy = mapSignInStrategyToClerk(strategy);

  WebBrowser.maybeCompleteAuthSession();
  await runtime.ensureActiveSession();

  const existingToken = await runtime.getToken();
  if (existingToken !== null) return;

  try {
    const result = await runtime.startSSOFlow({
      strategy: clerkStrategy,
      redirectUrl: AuthSession.makeRedirectUri({ path: 'sso-callback' }),
    });
    await finalizeClerkSsoFlowResult(result);
  } catch (error) {
    if (!isClerkAlreadySignedInError(error)) throw error;
    await runtime.ensureActiveSession();
  }
}

async function runClerkSignOut(): Promise<void> {
  const runtime = assertClerkRuntimeReady();
  await runtime.signOut();
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
    signIn: runClerkSignIn,
    signOut: runClerkSignOut,
    getFreshToken: readClerkFreshToken,
    ensureSessionReady: runClerkEnsureSessionReady,
  };
}
