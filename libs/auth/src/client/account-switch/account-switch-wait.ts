import {
  isBootErrorForTarget,
  isBootReadyForTarget,
  type SyncBootReport,
} from './account-switch-boot-gate';

export type BootReportReader = () => SyncBootReport;

/**
 * Resolves when sync boot is ready for `targetAccountId`, or rejects on a
 * matching boot error. `subscribe` must invoke `onChange` whenever the report
 * updates.
 *
 * When `targetAccountId` is null, requires a loading report first so a stale
 * ready from the previous identity cannot complete the wait early.
 */
export function waitForTargetBootReady(
  targetAccountId: string | null,
  read: BootReportReader,
  subscribe: (onChange: () => void) => () => void
): Promise<void> {
  let sawLoading = targetAccountId !== null;
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const report = read();
      if (report.phase === 'loading') sawLoading = true;
      if (isBootErrorForTarget(report, targetAccountId)) {
        unsubscribe();
        reject(new Error('Local database failed to open for the new account'));
        return;
      }
      if (!sawLoading) return;
      if (isBootReadyForTarget(report, targetAccountId)) {
        unsubscribe();
        resolve();
      }
    };
    const unsubscribe = subscribe(check);
    check();
  });
}
