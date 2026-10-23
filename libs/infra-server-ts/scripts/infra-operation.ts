// @io-wall-ok — infrastructure CLI operation deadlines and progress diagnostics.
import { boundedOperation } from '@libs/infra-shared-ts/bounded-operation';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';

export function infraOperation<T>(
  label: string,
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 30_000
): Promise<T> {
  return boundedOperation(run, wallClock, wallTimers, {
    label,
    timeoutMs,
    report: (message) => console.log(`[infra] ${message}`),
  });
}
