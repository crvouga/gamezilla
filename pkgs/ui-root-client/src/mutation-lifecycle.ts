/**
 * `useMutationLifecycle` -- phase machine behind `useMutationButton`,
 * `MutationModal`, and other submit surfaces.
 *
 * Observes one operation with a bounded wait and retains an uncertain
 * operation until its real outcome is known. The four phases are `idle`
 * (show the form or confirm body), `loading` (operation in flight), `success` (dismissible
 * confirmation), and `error` (a refusal or unconfirmed outcome). Must be called inside a reactive owner (component body).
 */

import { useTimers } from '@pkgs/clock-client/solid';
import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import { type Accessor, createEffect, on, onCleanup, untrack } from 'solid-js';
import { MutationObservation } from './mutation-observation';
import { usePendingOperation } from './pending-navigation';

export type MutationPhase = 'idle' | 'loading' | 'success' | 'error';

/** One phase change, delivered to `onPhaseChange`. */
export type MutationStateTransition = {
  readonly from: MutationPhase;
  readonly to: MutationPhase;
};

export type UseMutationLifecycleParams = {
  /** The mutation to run on submit. */
  operation: () => Promise<void>;
  /** Side-effect notified on failure (e.g. structured logging). */
  onError?: ((error: Error) => void) | undefined;
  /** Side-effect notified whenever the phase changes. */
  onPhaseChange?: ((transition: MutationStateTransition) => void) | undefined;
};

export type UseMutationLifecycleResult = {
  phase: Accessor<MutationPhase>;
  /** Populated only while `phase() === 'error'`. */
  error: Accessor<Error | null>;
  /** Run the operation; never rejects (failures surface via `phase`/`error`). */
  run: () => Promise<void>;
  /** Return to `idle` and drop any captured value/error. */
  reset: () => void;
};

export function useMutationLifecycle(
  params: UseMutationLifecycleParams
): UseMutationLifecycleResult {
  const observation = new MutationObservation({
    operation: () => params.operation(),
    timers: useTimers(),
    onError: (error) => params.onError?.(error),
  });
  onCleanup(observation.dispose);
  const state = createSubscriptionSignal(observation);
  const phase = (): MutationPhase => state().phase;
  const error = (): Error | null => state().error;
  // Leaving dismisses the observation; admitted writes retain their outcome.
  usePendingOperation(() => phase() === 'loading', observation.reset);
  // Track the previous phase ourselves: `on(..., { defer: true })` skips the
  // first run without recording it, so the first transition would lose `from`.
  createEffect(
    on(phase, (to, from) => {
      if (from === undefined || from === to) return;
      untrack(() => params.onPhaseChange?.({ from, to }));
    })
  );
  return { phase, error, run: observation.run, reset: observation.reset };
}
