import {
  isBootErrorForTarget,
  isBootReadyForTarget,
  type SyncBootReport,
} from './account-switch-boot-gate';

export type BootReportReader = () => SyncBootReport;

type WaitProgress = {
  sawLoading: boolean;
  sawBootChange: boolean;
};

function noteBootProgress(
  progress: WaitProgress,
  report: SyncBootReport,
  initial: SyncBootReport
): void {
  if (report.phase === 'loading') {
    progress.sawLoading = true;
  }
  if (
    report.phase !== initial.phase ||
    report.accountId !== initial.accountId
  ) {
    progress.sawBootChange = true;
  }
}

function isNullTargetReady(
  progress: WaitProgress,
  report: SyncBootReport
): boolean {
  if (!progress.sawLoading && !progress.sawBootChange) return false;
  return report.phase === 'ready';
}

function isAccountTargetReady(
  progress: WaitProgress,
  report: SyncBootReport,
  targetAccountId: string
): boolean {
  if (!progress.sawLoading) return false;
  return isBootReadyForTarget(report, targetAccountId);
}

/**
 * Resolves when sync boot is ready for `targetAccountId`, or rejects on a
 * matching boot error. `subscribe` must invoke `onChange` whenever the report
 * updates.
 *
 * When `targetAccountId` is null (anon / unbound roster), ignore a stale ready
 * from the previous identity: require a loading report, or any boot report
 * change (warm pool can go ready→ready on a new accountId without loading).
 */
export function waitForTargetBootReady(
  targetAccountId: string | null,
  read: BootReportReader,
  subscribe: (onChange: () => void) => () => void
): Promise<void> {
  const initial = read();
  const progress: WaitProgress = {
    sawLoading: targetAccountId !== null,
    sawBootChange: false,
  };
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const report = read();
      noteBootProgress(progress, report, initial);
      if (isBootErrorForTarget(report, targetAccountId)) {
        unsubscribe();
        reject(new Error('Local database failed to open for the new account'));
        return;
      }
      const ready =
        targetAccountId === null
          ? isNullTargetReady(progress, report)
          : isAccountTargetReady(progress, report, targetAccountId);
      if (!ready) return;
      unsubscribe();
      resolve();
    };
    const unsubscribe = subscribe(check);
    check();
  });
}
