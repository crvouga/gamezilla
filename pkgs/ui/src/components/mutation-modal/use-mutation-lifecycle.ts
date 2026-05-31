/**
 * `useMutationLifecycle` -- phase machine behind {@link MutationModal} and
 * other submit surfaces.
 *
 * Wraps the canonical {@link useAsync} helper and collapses its status into
 * the four phases a mutation UI cares about: `idle` (show the form / confirm
 * body), `loading` (operation in flight), `success` (dismissible confirmation),
 * and `error` (retryable failure). Cancellation maps back to `idle`.
 */

import { useCallback, useMemo } from 'react';
import { useAsync, type AsyncStatus } from '@pkgs/async/use-async';

export type MutationPhase = 'idle' | 'loading' | 'success' | 'error';

export type UseMutationLifecycleParams = {
  /** The mutation to run on submit. Wrap in `useCallback` to keep it stable. */
  operation: () => Promise<void>;
  /** Side-effect notified on failure (e.g. structured logging). */
  onError?: ((error: Error) => void) | undefined;
};

export type UseMutationLifecycleResult = {
  phase: MutationPhase;
  /** Populated only while `phase === 'error'`. */
  error: Error | null;
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

export function useMutationLifecycle({
  operation,
  onError,
}: UseMutationLifecycleParams): UseMutationLifecycleResult {
  const runOperation = useCallback(async (): Promise<void> => {
    await operation();
  }, [operation]);
  const handleError = useCallback(
    (error: Error) => {
      onError?.(error);
    },
    [onError]
  );
  const async = useAsync<void, []>({
    operation: runOperation,
    options: { onError: handleError },
  });
  const { status, error, reset } = async;
  const asyncRun = async.run;
  const run = useCallback(async (): Promise<void> => {
    try {
      await asyncRun();
    } catch {
      // Failure is captured in hook state; callers read `phase` / `error`.
    }
  }, [asyncRun]);
  return useMemo(
    () => ({ phase: mutationPhaseFromStatus(status), error, run, reset }),
    [status, error, run, reset]
  );
}
