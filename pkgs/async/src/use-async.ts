import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import {
  type AsyncRunContext,
  type AsyncRunnerOptions,
  type AsyncState,
  type AsyncStatus,
  createAsyncRunner,
} from './async-runner';

export type { AsyncRunContext, AsyncState, AsyncStatus } from './async-runner';

export type UseAsyncOptions<TArgs extends unknown[]> =
  AsyncRunnerOptions<TArgs>;

export type UseAsyncParams<TResult, TArgs extends unknown[]> = {
  operation: (context: AsyncRunContext, ...args: TArgs) => Promise<TResult>;
  options?: UseAsyncOptions<TArgs>;
};

export type UseAsyncResult<TResult, TArgs extends unknown[]> = {
  state: AsyncState<TResult>;
  status: AsyncStatus;
  loading: boolean;
  error: Error | null;
  value: TResult | null;
  run: (...args: TArgs) => Promise<TResult>;
  cancelAll: (reason?: string) => void;
  clearError: () => void;
  reset: () => void;
};

/**
 * Reusable async helper with request de-duplication and cancellation support.
 * A new runner is created when `operation` changes; the old one is disposed.
 */
export function useAsync<TResult, TArgs extends unknown[]>(
  params: UseAsyncParams<TResult, TArgs>
): UseAsyncResult<TResult, TArgs> {
  const { operation, options } = params;
  // Options are read through a ref so callers may pass inline objects.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const runner = useMemo(
    () =>
      createAsyncRunner<TResult, TArgs>(operation, {
        getKey: (...args) =>
          optionsRef.current?.getKey?.(...args) ?? '__default__',
        onError: (error, args) => optionsRef.current?.onError?.(error, args),
      }),
    [operation]
  );
  useEffect(() => () => runner.dispose(), [runner]);

  const state = useSyncExternalStore(
    runner.subscribe,
    runner.getSnapshot,
    runner.getSnapshot
  );

  return useMemo(
    () => ({
      state,
      status: state.status,
      loading: state.status === 'running',
      error: state.error,
      value: state.value,
      run: runner.run,
      cancelAll: runner.cancelAll,
      clearError: runner.clearError,
      reset: runner.reset,
    }),
    [state, runner]
  );
}
