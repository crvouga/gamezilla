/**
 * `useSignInModalLifecycle` -- phase machine behind {@link SignInModal}.
 *
 * Unlike a plain submit mutation, sign-in hands control to an external OAuth
 * flow that unloads the web page. So the loading state has to outlive the
 * trigger: we mark a durable pending flag, then resolve the outcome from the
 * auth port session once it settles (on this mount for native flows, or on the
 * next mount after the redirect on web).
 *
 * The `awaitingCallback` gate is load-bearing: while we are in `loading` but
 * the OAuth handoff has not produced a session yet, the snapshot still reads
 * "signed out". We only let the session watcher decide success/error after the
 * trigger has actually handed off (runner settled, or a pending marker was
 * found on mount).
 */

import { useSecureStorage } from '@pkgs/secure-storage/interface';
import type { SecureStorage } from '@pkgs/secure-storage/interface';
import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import { authSessionError, isAuthSessionSignedIn } from './session-snapshot';
import {
  clearSignInPending,
  markSignInPending,
  resolveSignInReturnHref,
} from './sign-in-pending';

export type SignInPhase = 'idle' | 'loading' | 'success' | 'error';

export type UseSignInModalLifecycleParams = {
  /** True once a non-stale pending marker is found on mount; resumes loading. */
  resumePending: boolean;
  /** Side-effect notified on failure (e.g. structured logging). */
  onError?: ((error: Error) => void) | undefined;
};

export type UseSignInModalLifecycleResult = {
  phase: SignInPhase;
  /** Populated only while `phase === 'error'`; `null` for cancelled OAuth. */
  error: Error | null;
  /** Begin a sign-in. Marks pending, then runs the redirect trigger. */
  start: (runner: () => Promise<void>) => Promise<void>;
  /** Return to the provider picker (idle) and drop any captured error. */
  reset: () => void;
  /** Clear the pending marker and reset (success dismiss). */
  dismiss: () => void;
};

function useResumePendingEffect(args: {
  resumePending: boolean;
  setPhase: (phase: SignInPhase) => void;
  setAwaitingCallback: (value: boolean) => void;
}): void {
  const { resumePending, setPhase, setAwaitingCallback } = args;
  useEffect(() => {
    if (!resumePending) return;
    setPhase('loading');
    setAwaitingCallback(true);
  }, [resumePending, setPhase, setAwaitingCallback]);
}

function resolveSignInOutcome(args: {
  authState: AuthSessionState;
  storage: SecureStorage;
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): void {
  const {
    authState,
    storage,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  } = args;
  if (isAuthSessionSignedIn(authState)) {
    setAwaitingCallback(false);
    setPhase('success');
    return;
  }
  const err = authSessionError(authState);
  if (err === null) return;
  setAwaitingCallback(false);
  void clearSignInPending(storage);
  onError?.(err);
  setError(err);
  setPhase('error');
}

function useSignInOutcomeEffect(args: {
  phase: SignInPhase;
  awaitingCallback: boolean;
  resumePending: boolean;
  authState: AuthSessionState;
  storage: SecureStorage;
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): void {
  const {
    phase,
    awaitingCallback,
    resumePending,
    authState,
    storage,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  } = args;
  useEffect(() => {
    if (!authState.isHydrated) return;

    // OAuth return: never leave the provider picker up once the session exists.
    if (
      resumePending &&
      isAuthSessionSignedIn(authState) &&
      phase !== 'success'
    ) {
      setAwaitingCallback(false);
      setPhase('success');
      return;
    }

    if (phase !== 'loading' || !awaitingCallback) return;
    resolveSignInOutcome({
      authState,
      storage,
      onError,
      setAwaitingCallback,
      setError,
      setPhase,
    });
  }, [
    phase,
    awaitingCallback,
    resumePending,
    authState,
    storage,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  ]);
}

function useSignInStart(args: {
  storage: SecureStorage;
  pathname: string;
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): (runner: () => Promise<void>) => Promise<void> {
  const {
    storage,
    pathname,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  } = args;
  return useCallback(
    async (runner: () => Promise<void>): Promise<void> => {
      setError(null);
      setPhase('loading');
      const returnHref = resolveSignInReturnHref(pathname);
      try {
        await markSignInPending(storage, {
          ...(returnHref !== undefined ? { returnHref } : {}),
        });
        await runner();
      } catch (e) {
        await clearSignInPending(storage);
        const err = e instanceof Error ? e : new Error(String(e));
        onError?.(err);
        setError(err);
        setPhase('error');
        return;
      }
      // Native AuthSession: runner only resolves after SSO finalize. Web
      // same-tab redirect never reaches here (`location.assign` + waitUntilUnload).
      setAwaitingCallback(false);
      setPhase('success');
    },
    [storage, onError, pathname, setAwaitingCallback, setError, setPhase]
  );
}

export function useSignInModalLifecycle({
  resumePending,
  onError,
}: UseSignInModalLifecycleParams): UseSignInModalLifecycleResult {
  const storage = useSecureStorage();
  const port = useAuthClientPort();
  const pathname = usePathname();
  const authState = port.useAuthSession();
  const [phase, setPhase] = useState<SignInPhase>(() =>
    resumePending ? 'loading' : 'idle'
  );
  const [error, setError] = useState<Error | null>(null);
  const [awaitingCallback, setAwaitingCallback] = useState(resumePending);

  useResumePendingEffect({
    resumePending,
    setPhase,
    setAwaitingCallback,
  });
  useSignInOutcomeEffect({
    phase,
    awaitingCallback,
    resumePending,
    authState,
    storage,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  });

  const start = useSignInStart({
    storage,
    pathname,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  });

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setAwaitingCallback(false);
  }, []);

  const dismiss = useCallback(() => {
    void clearSignInPending(storage);
    reset();
  }, [storage, reset]);

  return { phase, error, start, reset, dismiss };
}
