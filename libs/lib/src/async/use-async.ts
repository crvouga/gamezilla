import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type AsyncStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

export type AsyncRunContext = {
  abortController: AbortController;
  signal: AbortSignal;
};

export type AsyncState<TResult> =
  | { status: 'idle'; value: TResult | null; error: null }
  | { status: 'running'; value: TResult | null; error: null }
  | { status: 'success'; value: TResult; error: null }
  | { status: 'error'; value: TResult | null; error: Error }
  | { status: 'cancelled'; value: TResult | null; error: null };

export type UseAsyncOptions<TArgs extends unknown[]> = {
  getKey?: (...args: TArgs) => string;
  onError?: (error: Error, args: TArgs) => void;
};

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

type InFlightEntry<TResult> = {
  abortController: AbortController;
  promise: Promise<TResult>;
};

type Ref<T> = { current: T };

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : String(err));
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError';
}

function cancelInFlight<TResult>(
  inFlightRef: Ref<Map<string, InFlightEntry<TResult>>>,
  latestRequestIdRef: Ref<number>,
  reason: string
): void {
  latestRequestIdRef.current += 1;
  for (const { abortController } of inFlightRef.current.values()) {
    abortController.abort(reason);
  }
  inFlightRef.current.clear();
}

function createRunHandler<TResult, TArgs extends unknown[]>(args: {
  operation: (context: AsyncRunContext, ...runArgs: TArgs) => Promise<TResult>;
  setState: Dispatch<SetStateAction<AsyncState<TResult>>>;
  inFlightRef: Ref<Map<string, InFlightEntry<TResult>>>;
  latestRequestIdRef: Ref<number>;
  mountedRef: Ref<boolean>;
  optionsRef: Ref<UseAsyncOptions<TArgs>>;
}): (...runArgs: TArgs) => Promise<TResult> {
  const {
    operation,
    setState,
    inFlightRef,
    latestRequestIdRef,
    mountedRef,
    optionsRef,
  } = args;

  return (...runArgs: TArgs): Promise<TResult> => {
    const key = optionsRef.current.getKey?.(...runArgs) ?? '__default__';
    const existing = inFlightRef.current.get(key);
    if (existing !== undefined) return existing.promise;

    const requestId = ++latestRequestIdRef.current;
    const abortController = new AbortController();
    if (mountedRef.current) {
      setState((prev) => ({ status: 'running', value: prev.value, error: null }));
    }

    const promise = (async () => {
      try {
        const result = await operation(
          { abortController, signal: abortController.signal },
          ...runArgs
        );
        if (mountedRef.current && requestId === latestRequestIdRef.current) {
          setState({ status: 'success', value: result, error: null });
        }
        return result;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          if (mountedRef.current && requestId === latestRequestIdRef.current) {
            setState((prev) => ({
              status: 'cancelled',
              value: prev.value,
              error: null,
            }));
          }
          throw err;
        }

        const normalizedError = toError(err);
        if (mountedRef.current && requestId === latestRequestIdRef.current) {
          setState((prev) => ({
            status: 'error',
            value: prev.value,
            error: normalizedError,
          }));
        }
        optionsRef.current.onError?.(normalizedError, runArgs);
        throw normalizedError;
      } finally {
        inFlightRef.current.delete(key);
      }
    })();

    inFlightRef.current.set(key, { abortController, promise });
    return promise;
  };
}

/**
 * Reusable async helper with request de-duplication and cancellation support.
 */
export function useAsync<TResult, TArgs extends unknown[]>(
  params: UseAsyncParams<TResult, TArgs>
): UseAsyncResult<TResult, TArgs> {
  const { operation, options = {} } = params;
  const [state, setState] = useState<AsyncState<TResult>>({
    status: 'idle',
    value: null,
    error: null,
  });
  const mountedRef = useRef(true);
  const latestRequestIdRef = useRef(0);
  const inFlightRef = useRef<Map<string, InFlightEntry<TResult>>>(new Map());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const cancelAll = useCallback((reason = 'Cancelled') => {
    cancelInFlight(inFlightRef, latestRequestIdRef, reason);
    if (!mountedRef.current) return;
    setState((prev) =>
      prev.status === 'running'
        ? { status: 'cancelled', value: prev.value, error: null }
        : prev
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAll('Unmounted');
    };
  }, [cancelAll]);

  const clearError = useCallback(() => {
    setState((prev) =>
      prev.status === 'error'
        ? { status: 'idle', value: prev.value, error: null }
        : prev
    );
  }, []);
  const reset = useCallback(() => {
    cancelAll('Reset');
    setState({ status: 'idle', value: null, error: null });
  }, [cancelAll]);
  const runHandler = useMemo(
    () =>
      createRunHandler({
        operation,
        setState,
        inFlightRef,
        latestRequestIdRef,
        mountedRef,
        optionsRef,
      }),
    [operation]
  );
  const run = useCallback((...args: TArgs) => runHandler(...args), [runHandler]);
  const loading = state.status === 'running';

  return useMemo(
    () => ({
      state,
      status: state.status,
      loading,
      error: state.error,
      value: state.value,
      run,
      cancelAll,
      clearError,
      reset,
    }),
    [state, loading, run, cancelAll, clearError, reset]
  );
}
