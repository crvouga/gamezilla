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

import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { useSecureStorageStore } from '@pkgs/secure-storage/use-secure-storage-item';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

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

/** If OAuth resume never settles, clear the durable marker so refresh can recover. */
const RESUME_PENDING_TIMEOUT_MS = 12_000;

function useResumePendingEffect(args: {
  resumePending: boolean;
  /** True while `start()` is running on this page (pre-redirect). */
  startInFlightRef: { current: boolean };
  store: SecureStorageStore;
  setPhase: (phase: SignInPhase) => void;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
}): void {
  const {
    resumePending,
    startInFlightRef,
    store,
    setPhase,
    setAwaitingCallback,
    setError,
  } = args;
  useEffect(() => {
    if (!resumePending) return;
    // `markSignInPending` during start() flips resumePending on this same page
    // before Google loads — do not treat that as a completed OAuth return.
    if (startInFlightRef.current) return;
    setPhase('loading');
    setAwaitingCallback(true);
  }, [resumePending, startInFlightRef, setPhase, setAwaitingCallback]);

  useEffect(() => {
    if (!resumePending || startInFlightRef.current) return;
    const timer = setTimeout(() => {
      if (startInFlightRef.current) return;
      void clearSignInPending(store);
      setAwaitingCallback(false);
      setError(new Error('Sign-in timed out. Please try again.'));
      setPhase('error');
    }, RESUME_PENDING_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [
    resumePending,
    startInFlightRef,
    store,
    setPhase,
    setAwaitingCallback,
    setError,
  ]);
}

function resolveSignInOutcome(args: {
  authState: AuthSessionState;
  store: SecureStorageStore;
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): void {
  const { authState, store, onError, setAwaitingCallback, setError, setPhase } =
    args;
  if (isAuthSessionSignedIn(authState)) {
    setAwaitingCallback(false);
    setPhase('success');
    return;
  }
  const err = authSessionError(authState);
  if (err !== null) {
    setAwaitingCallback(false);
    void clearSignInPending(store);
    onError?.(err);
    setError(err);
    setPhase('error');
    return;
  }
  // Resume path only (awaitingCallback): hydrated signed-out with no error means
  // OAuth did not establish a session (cancel / handoff race). Do not hang.
  if (!authState.isHydrated) return;
  setAwaitingCallback(false);
  void clearSignInPending(store);
  setError(null);
  setPhase('error');
}

function useSignInOutcomeEffect(args: {
  phase: SignInPhase;
  awaitingCallback: boolean;
  resumePending: boolean;
  startInFlightRef: { current: boolean };
  authState: AuthSessionState;
  store: SecureStorageStore;
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): void {
  const {
    phase,
    awaitingCallback,
    resumePending,
    startInFlightRef,
    authState,
    store,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  } = args;
  useEffect(() => {
    if (!authState.isHydrated) return;
    // Same-page redirect handoff: keep loading until the document unloads.
    if (startInFlightRef.current) return;

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
      store,
      onError,
      setAwaitingCallback,
      setError,
      setPhase,
    });
  }, [
    phase,
    awaitingCallback,
    resumePending,
    startInFlightRef,
    authState,
    store,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  ]);
}

function useSignInStart(args: {
  store: SecureStorageStore;
  pathname: string;
  startInFlightRef: { current: boolean };
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): (runner: () => Promise<void>) => Promise<void> {
  const {
    store,
    pathname,
    startInFlightRef,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  } = args;
  return useCallback(
    async (runner: () => Promise<void>): Promise<void> => {
      setError(null);
      setPhase('loading');
      startInFlightRef.current = true;
      const returnHref = resolveSignInReturnHref(pathname);
      try {
        await markSignInPending(store, {
          ...(returnHref !== undefined ? { returnHref } : {}),
        });
        await runner();
      } catch (e) {
        startInFlightRef.current = false;
        await clearSignInPending(store);
        const err = e instanceof Error ? e : new Error(String(e));
        onError?.(err);
        setError(err);
        setPhase('error');
        return;
      }
      // Native AuthSession: runner only resolves after SSO finalize. Web
      // same-tab redirect never reaches here (`location.assign` + waitUntilUnload).
      startInFlightRef.current = false;
      setAwaitingCallback(false);
      setPhase('success');
    },
    [
      store,
      onError,
      pathname,
      startInFlightRef,
      setAwaitingCallback,
      setError,
      setPhase,
    ]
  );
}

export function useSignInModalLifecycle({
  resumePending,
  onError,
}: UseSignInModalLifecycleParams): UseSignInModalLifecycleResult {
  const store = useSecureStorageStore();
  const port = useAuthClientPort();
  const pathname = usePathname();
  const authState = port.useAuthSession();
  const startInFlightRef = useRef(false);
  const [phase, setPhase] = useState<SignInPhase>(() =>
    resumePending ? 'loading' : 'idle'
  );
  const [error, setError] = useState<Error | null>(null);
  const [awaitingCallback, setAwaitingCallback] = useState(resumePending);

  useResumePendingEffect({
    resumePending,
    startInFlightRef,
    store,
    setPhase,
    setAwaitingCallback,
    setError,
  });
  useSignInOutcomeEffect({
    phase,
    awaitingCallback,
    resumePending,
    startInFlightRef,
    authState,
    store,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  });

  const start = useSignInStart({
    store,
    pathname,
    startInFlightRef,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  });

  const reset = useCallback(() => {
    startInFlightRef.current = false;
    setPhase('idle');
    setError(null);
    setAwaitingCallback(false);
  }, [startInFlightRef]);

  const dismiss = useCallback(() => {
    void clearSignInPending(store);
    reset();
  }, [store, reset]);

  return { phase, error, start, reset, dismiss };
}
