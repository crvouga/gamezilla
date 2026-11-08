import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import {
  type PrCheck,
  type RequiredPrCheck,
  requiredPrCheckFailures,
} from './required-pr-checks';

export type PrCheckSnapshot = {
  readonly checks: readonly PrCheck[];
  /** SHAs with an unfinished GitHub default-setup CodeQL producer. */
  readonly activeCodeqlShas: readonly string[];
};

function unfinished(check: PrCheck, snapshot: PrCheckSnapshot): boolean {
  if (check.status !== 'completed') return check.conclusion === null;
  return (
    check.appId === 57789 &&
    check.name === 'CodeQL' &&
    check.conclusion === 'neutral' &&
    check.sha !== undefined &&
    snapshot.activeCodeqlShas.includes(check.sha)
  );
}

/** Observe unfinished producers; never rerun checks or reconsider a failed verdict. */
export async function awaitRequiredPrChecks(options: {
  readonly required: readonly RequiredPrCheck[];
  readonly emptyShardPlan: boolean;
  readonly read: () => PrCheckSnapshot;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly timeoutMs: number;
  readonly intervalMs: number;
}): Promise<readonly PrCheck[]> {
  const deadline = options.clock.now() + options.timeoutMs;
  for (;;) {
    const snapshot = options.read();
    const failures = requiredPrCheckFailures(
      options.required,
      snapshot.checks,
      options.emptyShardPlan
    );
    if (options.clock.now() > deadline)
      throw new Error(
        'PR checks readiness deadline exceeded during metadata collection'
      );
    if (failures.length === 0) return snapshot.checks;
    // This projection identifies terminal errors only. It can never grant success:
    // only the original, unmodified snapshot above can satisfy the gate.
    const terminal = requiredPrCheckFailures(
      options.required,
      snapshot.checks.map((check) =>
        unfinished(check, snapshot)
          ? { ...check, status: 'completed', conclusion: 'success' }
          : check
      ),
      options.emptyShardPlan
    ).filter((failure) => !failure.startsWith('Missing required check:'));
    if (terminal.length > 0) throw new Error(terminal.join('\n'));
    const remaining = deadline - options.clock.now();
    if (remaining <= 0)
      throw new Error(
        `PR checks readiness deadline exceeded:\n${failures.join('\n')}`
      );
    await new Promise<void>((resolve) => {
      options.timers.setTimeout(
        resolve,
        Math.min(options.intervalMs, remaining)
      );
    });
  }
}
