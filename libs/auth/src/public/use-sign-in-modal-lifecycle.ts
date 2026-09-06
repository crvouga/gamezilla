/**
 * `useSignInModalLifecycle` -- phase machine behind {@link SignInModal}.
 *
 * Unlike a plain submit mutation, sign-in hands control to an external OAuth
 * flow that unloads the web page. So the loading state has to outlive the
 * trigger: we mark a durable pending flag, then resolve the outcome from the
 * local session token and/or auth port session once it settles (on this mount
 * for native flows, or on the next mount after the redirect on web).
 *
 * The `awaitingCallback` gate is load-bearing: while we are in `loading` but
 * the OAuth handoff has not produced a session yet, the snapshot still reads
 * "signed out". We only let the session watcher decide success/error after the
 * trigger has actually handed off (runner settled, or a pending marker was
 * found on mount).
 */

import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import { useClock, useTimers } from '@pkgs/clock/solid';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { useSecureStorageStore } from '@pkgs/secure-storage/solid';
import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import { usePathname } from '@pkgs/ui';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

import { useAuthClientPort } from './auth-client-provider';
import { authSessionError, isAuthSessionSignedIn } from './session-snapshot';
import { resolveSignInReturnHref, SignInPendingStore } from './sign-in-pending';
import { useFreshAuthToken } from './use-fresh-auth-token';

export type SignInPhase = 'idle' | 'loading' | 'success' | 'error';

export type UseSignInModalLifecycleParams = {
  /** True once a non-stale pending marker is found on mount; resumes loading. */
  resumePending: Accessor<boolean>;
  /** Side-effect notified on failure (e.g. structured logging). */
  onError?: ((error: Error) => void) | undefined;
};

export type UseSignInModalLifecycleResult = {
  phase: Accessor<SignInPhase>;
  /** Populated only while `phase() === 'error'`; `null` for cancelled OAuth. */
  error: Accessor<Error | null>;
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
  resumePending: Accessor<boolean>;
  /** True while `start()` is running on this page (pre-redirect). */
  startInFlightRef: { current: boolean };
  store: SecureStorageStore;
  setPhase: (phase: SignInPhase) => void;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
}): void {
  const timers = useTimers();
  createEffect(() => {
    if (!args.resumePending()) return;
    // `markSignInPending` during start() flips resumePending on this same page
    // before Google loads — do not treat that as a completed OAuth return.
    if (args.startInFlightRef.current) return;
    args.setPhase('loading');
    args.setAwaitingCallback(true);
  });

  createEffect(() => {
    if (!args.resumePending() || args.startInFlightRef.current) return;
    const timer = timers.setTimeout(() => {
      if (args.startInFlightRef.current) return;
      void new SignInPendingStore(args.store).clear();
      args.setAwaitingCallback(false);
      args.setError(new Error('Sign-in timed out. Please try again.'));
      args.setPhase('error');
    }, RESUME_PENDING_TIMEOUT_MS);
    onCleanup(() => {
      timers.clearTimeout(timer);
    });
  });
}

function isLocalOrBaSignedIn(args: {
  authState: AuthSessionState;
  localToken: string | null;
}): boolean {
  return isAuthSessionSignedIn(args.authState) || args.localToken !== null;
}

function resolveSignInOutcome(args: {
  authState: AuthSessionState;
  localToken: string | null;
  store: SecureStorageStore;
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): void {
  if (isLocalOrBaSignedIn(args)) {
    args.setAwaitingCallback(false);
    args.setPhase('success');
    return;
  }
  const err = authSessionError(args.authState);
  if (err !== null) {
    args.setAwaitingCallback(false);
    void new SignInPendingStore(args.store).clear();
    args.onError?.(err);
    args.setError(err);
    args.setPhase('error');
    return;
  }
  // Resume path only (awaitingCallback): hydrated signed-out with no error means
  // OAuth did not establish a session (cancel / handoff race). Do not hang.
  if (!args.authState.isHydrated) return;
  args.setAwaitingCallback(false);
  void new SignInPendingStore(args.store).clear();
  args.setError(null);
  args.setPhase('error');
}

function useSignInOutcomeEffect(args: {
  phase: Accessor<SignInPhase>;
  awaitingCallback: Accessor<boolean>;
  resumePending: Accessor<boolean>;
  startInFlightRef: { current: boolean };
  authState: Accessor<AuthSessionState>;
  localToken: Accessor<string | null>;
  store: SecureStorageStore;
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): void {
  createEffect(() => {
    const authState = args.authState();
    const localToken = args.localToken();
    if (!authState.isHydrated && localToken === null) return;
    // Same-page redirect handoff: keep loading until the document unloads.
    if (args.startInFlightRef.current) return;

    // OAuth return: never leave the provider picker up once the session exists.
    if (
      args.resumePending() &&
      isLocalOrBaSignedIn({ authState, localToken }) &&
      args.phase() !== 'success'
    ) {
      args.setAwaitingCallback(false);
      args.setPhase('success');
      return;
    }

    if (args.phase() !== 'loading' || !args.awaitingCallback()) return;
    resolveSignInOutcome({
      authState,
      localToken,
      store: args.store,
      onError: args.onError,
      setAwaitingCallback: args.setAwaitingCallback,
      setError: args.setError,
      setPhase: args.setPhase,
    });
  });
}

function createSignInStart(args: {
  store: SecureStorageStore;
  pathname: Accessor<string>;
  now: () => number;
  startInFlightRef: { current: boolean };
  onError: ((error: Error) => void) | undefined;
  setAwaitingCallback: (value: boolean) => void;
  setError: (error: Error | null) => void;
  setPhase: (phase: SignInPhase) => void;
}): (runner: () => Promise<void>) => Promise<void> {
  return async (runner: () => Promise<void>): Promise<void> => {
    args.setError(null);
    args.setPhase('loading');
    args.startInFlightRef.current = true;
    const returnHref = resolveSignInReturnHref(args.pathname());
    try {
      void new SignInPendingStore(args.store).mark(args.now, {
        ...(returnHref !== undefined ? { returnHref } : {}),
      });
      await runner();
    } catch (e) {
      args.startInFlightRef.current = false;
      await new SignInPendingStore(args.store).clear();
      const err = e instanceof Error ? e : new Error(String(e));
      args.onError?.(err);
      args.setError(err);
      args.setPhase('error');
      return;
    }
    // Native AuthSession: runner only resolves after SSO finalize. Web
    // same-tab redirect never reaches here (`location.assign` + waitUntilUnload).
    args.startInFlightRef.current = false;
    args.setAwaitingCallback(false);
    args.setPhase('success');
  };
}

export function useSignInModalLifecycle({
  resumePending,
  onError,
}: UseSignInModalLifecycleParams): UseSignInModalLifecycleResult {
  const store = useSecureStorageStore();
  const port = useAuthClientPort();
  const pathname = usePathname();
  const clock = useClock();
  const authState = createSubscriptionSignal(port.session);
  const localToken = useFreshAuthToken();
  const startInFlightRef = { current: false };
  const [phase, setPhase] = createSignal<SignInPhase>(
    resumePending() ? 'loading' : 'idle'
  );
  const [error, setError] = createSignal<Error | null>(null);
  const [awaitingCallback, setAwaitingCallback] = createSignal(resumePending());

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
    localToken,
    store,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  });

  const start = createSignInStart({
    store,
    pathname,
    now: () => clock.now(),
    startInFlightRef,
    onError,
    setAwaitingCallback,
    setError,
    setPhase,
  });

  const reset = () => {
    startInFlightRef.current = false;
    setPhase('idle');
    setError(null);
    setAwaitingCallback(false);
  };

  const dismiss = () => {
    void new SignInPendingStore(store).clear();
    reset();
  };

  return { phase, error, start, reset, dismiss };
}
