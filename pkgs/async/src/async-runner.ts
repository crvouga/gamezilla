/**
 * Framework-free core of `useAsync` / `createAsync`: request de-duplication
 * by key, cancellation via `AbortController`, and a status state machine
 * exposed through `getSnapshot` / `subscribe` so any UI layer can bind it.
 */

export type AsyncStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

export type AsyncRunContext = {
  readonly abortController: AbortController;
  readonly signal: AbortSignal;
};

export type AsyncState<TResult> =
  | { status: 'idle'; value: TResult | null; error: null }
  | { status: 'running'; value: TResult | null; error: null }
  | { status: 'success'; value: TResult; error: null }
  | { status: 'error'; value: TResult | null; error: Error }
  | { status: 'cancelled'; value: TResult | null; error: null };

export type AsyncRunnerOptions<TArgs extends unknown[]> = {
  readonly getKey?: (...args: TArgs) => string;
  readonly onError?: (error: Error, args: TArgs) => void;
};

export type AsyncOperation<TResult, TArgs extends unknown[]> = (
  context: AsyncRunContext,
  ...args: TArgs
) => Promise<TResult>;

export type AsyncRunner<TResult, TArgs extends unknown[]> = {
  readonly getSnapshot: () => AsyncState<TResult>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly run: (...args: TArgs) => Promise<TResult>;
  readonly cancelAll: (reason?: string) => void;
  readonly clearError: () => void;
  readonly reset: () => void;
  /** Cancels in-flight work and stops publishing state changes. */
  readonly dispose: () => void;
};

type InFlightEntry<TResult> = {
  readonly abortController: AbortController;
  readonly promise: Promise<TResult>;
};

type StateUpdate<TResult> =
  | AsyncState<TResult>
  | ((prev: AsyncState<TResult>) => AsyncState<TResult>);

export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : String(err));
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError';
}

class AsyncRunnerImpl<TResult, TArgs extends unknown[]>
  implements AsyncRunner<TResult, TArgs>
{
  private state: AsyncState<TResult> = {
    status: 'idle',
    value: null,
    error: null,
  };
  private live = true;
  private latestRequestId = 0;
  private readonly inFlight = new Map<string, InFlightEntry<TResult>>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly operation: AsyncOperation<TResult, TArgs>,
    private readonly options: AsyncRunnerOptions<TArgs>
  ) {}

  readonly getSnapshot = (): AsyncState<TResult> => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly run = (...args: TArgs): Promise<TResult> => {
    const key = this.options.getKey?.(...args) ?? '__default__';
    const existing = this.inFlight.get(key);
    if (existing !== undefined) return existing.promise;

    const requestId = ++this.latestRequestId;
    const abortController = new AbortController();
    this.setState((prev) => ({
      status: 'running',
      value: prev.value,
      error: null,
    }));
    const promise = this.execute(key, requestId, abortController, args);
    this.inFlight.set(key, { abortController, promise });
    return promise;
  };

  readonly cancelAll = (reason = 'Cancelled'): void => {
    this.cancelInFlight(reason);
    this.setState((prev) =>
      prev.status === 'running'
        ? { status: 'cancelled', value: prev.value, error: null }
        : prev
    );
  };

  readonly clearError = (): void => {
    this.setState((prev) =>
      prev.status === 'error'
        ? { status: 'idle', value: prev.value, error: null }
        : prev
    );
  };

  readonly reset = (): void => {
    this.cancelAll('Reset');
    this.setState({ status: 'idle', value: null, error: null });
  };

  readonly dispose = (): void => {
    this.cancelInFlight('Unmounted');
    this.live = false;
    this.listeners.clear();
  };

  private async execute(
    key: string,
    requestId: number,
    abortController: AbortController,
    args: TArgs
  ): Promise<TResult> {
    const isLatest = (): boolean => requestId === this.latestRequestId;
    try {
      const result = await this.operation(
        { abortController, signal: abortController.signal },
        ...args
      );
      if (isLatest()) {
        this.setState({ status: 'success', value: result, error: null });
      }
      return result;
    } catch (err: unknown) {
      if (isAbortError(err)) {
        if (isLatest()) {
          this.setState((prev) => ({
            status: 'cancelled',
            value: prev.value,
            error: null,
          }));
        }
        throw err;
      }
      const normalized = toError(err);
      if (isLatest()) {
        this.setState((prev) => ({
          status: 'error',
          value: prev.value,
          error: normalized,
        }));
      }
      this.options.onError?.(normalized, args);
      throw normalized;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private setState(next: StateUpdate<TResult>): void {
    if (!this.live) return;
    const resolved = typeof next === 'function' ? next(this.state) : next;
    if (resolved === this.state) return;
    this.state = resolved;
    for (const listener of [...this.listeners]) listener();
  }

  private cancelInFlight(reason: string): void {
    this.latestRequestId += 1;
    for (const { abortController } of this.inFlight.values()) {
      abortController.abort(reason);
    }
    this.inFlight.clear();
  }
}

export function createAsyncRunner<TResult, TArgs extends unknown[]>(
  operation: AsyncOperation<TResult, TArgs>,
  options: AsyncRunnerOptions<TArgs> = {}
): AsyncRunner<TResult, TArgs> {
  return new AsyncRunnerImpl(operation, options);
}
