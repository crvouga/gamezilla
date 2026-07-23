export type SyncBootPhase = 'loading' | 'ready' | 'error';

export type SyncBootReport = {
  readonly phase: SyncBootPhase;
  readonly accountId: string | null;
};

/** True when boot is ready for the switch target (null target accepts any ready). */
export function isBootReadyForTarget(
  report: SyncBootReport,
  targetAccountId: string | null
): boolean {
  if (report.phase !== 'ready') return false;
  if (targetAccountId === null) return true;
  return report.accountId === targetAccountId;
}

/** True when boot failed for the switch target. */
export function isBootErrorForTarget(
  report: SyncBootReport,
  targetAccountId: string | null
): boolean {
  if (report.phase !== 'error') return false;
  if (targetAccountId === null) return true;
  return report.accountId === targetAccountId;
}
