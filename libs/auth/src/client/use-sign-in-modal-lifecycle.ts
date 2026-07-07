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
import { useCallback, useEffect, useState } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import { authSessionError, isAuthSessionSignedIn } from './session-snapshot';
import { clearSignInPending, markSignInPending } from './sign-in-pending';

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

export function useSignInModalLifecycle({
  resumePending,
  onError,
}: UseSignInModalLifecycleParams): UseSignInModalLifecycleResult {
  const storage = useSecureStorage();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const [phase, setPhase] = useState<SignInPhase>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [awaitingCallback, setAwaitingCallback] = useState(false);

  useEffect(() => {
    if (!resumePending) return;
    setPhase('loading');
    setAwaitingCallback(true);
    if (authState.isHydrated && isAuthSessionSignedIn(authState)) {
      setAwaitingCallback(false);
      setPhase('success');
    }
  }, [resumePending, authState]);

  useEffect(() => {
    if (phase !== 'loading' || !awaitingCallback || !authState.isHydrated) {
      return;
    }
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
  }, [phase, awaitingCallback, authState, storage, onError]);

  const start = useCallback(
    async (runner: () => Promise<void>): Promise<void> => {
      setError(null);
      setPhase('loading');
      await markSignInPending(storage);
      try {
        await runner();
      } catch (e) {
        await clearSignInPending(storage);
        const err = e instanceof Error ? e : new Error(String(e));
        onError?.(err);
        setError(err);
        setPhase('error');
        return;
      }
      setAwaitingCallback(true);
    },
    [storage, onError]
  );

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
