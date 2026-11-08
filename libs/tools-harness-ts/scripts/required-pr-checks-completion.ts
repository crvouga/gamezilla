import type { PrCheck, RequiredPrCheck } from './required-pr-checks';

/** Observe existing dependencies; never rerun a check or accept a pending verdict. */
export async function completedPrChecks(
  required: readonly RequiredPrCheck[],
  read: () => readonly PrCheck[] | Promise<readonly PrCheck[]>,
  pause: () => Promise<unknown>
): Promise<readonly PrCheck[]> {
  for (;;) {
    const checks = await read();
    const pending = checks.some(
      (check) =>
        check.status !== 'completed' &&
        !(check.appId === 15368 && check.name === 'verify:end') &&
        required.some(
          (policy) =>
            policy.context === check.name &&
            policy.integration_id === check.appId
        )
    );
    if (!pending) return checks;
    await pause();
  }
}
