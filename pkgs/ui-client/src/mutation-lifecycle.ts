/**
 * `useMutationLifecycle` -- phase machine behind `useMutationButton`,
 * `MutationModal`, and other submit surfaces.
 *
 * Wraps the canonical {@link createAsync} helper and collapses its status
 * into the four phases a mutation UI cares about: `idle` (show the form /
 * confirm body), `loading` (operation in flight), `success` (dismissible
 * confirmation), and `error` (retryable failure). Cancellation maps back to
 * `idle`. Must be called inside a reactive owner (component body).
 */

import { createAsync } from '@pkgs/async-client/solid';
import type { AsyncStatus } from '@pkgs/async-shared/async-runner';
import { type Accessor, createEffect, on, untrack } from 'solid-js';

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

/**
 * Collapse an {@link AsyncStatus} into the four phases a mutation UI renders.
 * `idle` and `cancelled` both present the editable / confirm body again so a
 * cancelled run lets the user retry from scratch.
 */
export function mutationPhaseFromStatus(status: AsyncStatus): MutationPhase {
  if (status === 'running') return 'loading';
  if (status === 'success') return 'success';
  if (status === 'error') return 'error';
  return 'idle';
}

export function useMutationLifecycle(
  params: UseMutationLifecycleParams
): UseMutationLifecycleResult {
  const async = createAsync({
    operation: async (): Promise<void> => {
      await params.operation();
    },
    options: {
      onError: (error) => {
        params.onError?.(error);
      },
    },
  });
  const phase = (): MutationPhase => mutationPhaseFromStatus(async.status());
  const run = async (): Promise<void> => {
    try {
      await async.run();
    } catch {
      // Failure is captured in async state; callers read `phase` / `error`.
    }
  };
  // Track the previous phase ourselves: `on(..., { defer: true })` skips the
  // first run without recording it, so the first transition would lose `from`.
  createEffect(
    on(phase, (to, from) => {
      if (from === undefined || from === to) return;
      untrack(() => params.onPhaseChange?.({ from, to }));
    })
  );
  return { phase, error: async.error, run, reset: async.reset };
}
