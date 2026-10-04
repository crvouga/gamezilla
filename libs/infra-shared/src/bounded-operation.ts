import type { Clock, Timers } from '@pkgs/clock-shared/types';

export type OperationOptions = {
  readonly label: string;
  readonly timeoutMs: number;
  readonly report: (message: string) => void;
};

/** A stalled read fails closed, with its operation named rather than a scenario timeout. */
export async function boundedOperation<T>(
  run: (signal: AbortSignal) => Promise<T>,
  clock: Clock,
  timers: Timers,
  options: OperationOptions
): Promise<T> {
  const started = clock.now();
  const controller = new AbortController();
  options.report(`${options.label}: started`);
  let timer: unknown;
  const deadline = new Promise<T>((_, reject) => {
    timer = timers.setTimeout(() => {
      const error = new Error(
        `${options.label} exceeded ${options.timeoutMs}ms`
      );
      reject(error);
      controller.abort(error);
    }, options.timeoutMs);
  });
  try {
    const result = await Promise.race([run(controller.signal), deadline]);
    options.report(`${options.label}: finished in ${clock.now() - started}ms`);
    return result;
  } catch (error) {
    options.report(`${options.label}: failed after ${clock.now() - started}ms`);
    throw error;
  } finally {
    timers.clearTimeout(timer);
  }
}
