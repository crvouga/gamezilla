import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import { type Accessor, onCleanup } from 'solid-js';

import {
  type AsyncRunContext,
  type AsyncRunnerOptions,
  type AsyncState,
  type AsyncStatus,
  createAsyncRunner,
} from './async-runner';

export type CreateAsyncParams<TResult, TArgs extends unknown[]> = {
  readonly operation: (
    context: AsyncRunContext,
    ...args: TArgs
  ) => Promise<TResult>;
  readonly options?: AsyncRunnerOptions<TArgs>;
};

export type CreateAsyncResult<TResult, TArgs extends unknown[]> = {
  readonly state: Accessor<AsyncState<TResult>>;
  readonly status: Accessor<AsyncStatus>;
  readonly loading: Accessor<boolean>;
  readonly error: Accessor<Error | null>;
  readonly value: Accessor<TResult | null>;
  readonly run: (...args: TArgs) => Promise<TResult>;
  readonly cancelAll: (reason?: string) => void;
  readonly clearError: () => void;
  readonly reset: () => void;
};

/**
 * Solid async helper with request de-duplication and cancellation. In-flight
 * work is aborted when the owning reactive scope disposes.
 */
export function createAsync<TResult, TArgs extends unknown[]>(
  params: CreateAsyncParams<TResult, TArgs>
): CreateAsyncResult<TResult, TArgs> {
  const runner = createAsyncRunner(params.operation, params.options);
  onCleanup(() => runner.dispose());
  const state = createSubscriptionSignal(runner);
  return {
    state,
    status: () => state().status,
    loading: () => state().status === 'running',
    error: () => state().error,
    value: () => state().value,
    run: runner.run,
    cancelAll: runner.cancelAll,
    clearError: runner.clearError,
    reset: runner.reset,
  };
}
