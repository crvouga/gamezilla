import { type Target, type TofuPaths, varFileArgs } from './tofu-command';

/** State JSON may contain credentials unknown to the environment redactor. */
export function mayPrintToolStdout(
  operation: string,
  capture: boolean
): boolean {
  return !capture && !['show', 'output', 'state'].includes(operation);
}

/** Interrupt OpenTofu so its deferred state-lock cleanup can run. */
export function toolDeadline(operation: string) {
  return operation === 'apply'
    ? {}
    : { timeout: 180_000, killSignal: 'SIGINT' as const };
}

const LOCK_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Recovery requires the exact lock identity observed on a completed runner. */
export function stateUnlockArgs(
  lockId: string,
  paths: TofuPaths,
  target: Target
): readonly string[] {
  if (!LOCK_ID.test(lockId))
    throw new Error('Supply the exact abandoned OpenTofu lock UUID');
  return ['force-unlock', '-force', ...varFileArgs(paths, target), lockId];
}

/** Bootstrap / repository-policy recovery (global state object). */
export function repositoryUnlockArgs(
  lockId: string,
  paths: TofuPaths
): readonly string[] {
  return stateUnlockArgs(lockId, paths, { stack: 'bootstrap', env: null });
}

/** GitHub-hosted runners stop every job after six hours. */
const HOSTED_JOB_LIMIT_MS = 6 * 60 * 60 * 1000;
/** Slack for clock skew between the runner that locked and this one. */
const LOCK_AGE_MARGIN_MS = 60 * 60 * 1000;

/** The S3 lock object OpenTofu writes beside a state object (`use_lockfile`). */
export function stateLockKey(target: Target): string {
  return `${target.stack}/${target.env ?? 'global'}.tfstate.tflock`;
}

/**
 * The lock ID to release when a lock is provably abandoned: a GitHub-hosted
 * runner took it longer ago than any hosted job may run, so the job that held
 * it has ended. A lock from anyone else (a person's machine) is never released.
 */
export function abandonedLockId(lockObject: string, now: Date): string | null {
  let info: unknown;
  try {
    info = JSON.parse(lockObject);
  } catch {
    return null;
  }
  if (typeof info !== 'object' || info === null) return null;
  const { ID, Who, Created } = info as Record<string, unknown>;
  if (typeof ID !== 'string' || !LOCK_ID.test(ID)) return null;
  if (typeof Who !== 'string' || !Who.startsWith('runner@')) return null;
  if (typeof Created !== 'string') return null;
  const created = Date.parse(Created);
  if (Number.isNaN(created)) return null;
  const age = now.getTime() - created;
  return age > HOSTED_JOB_LIMIT_MS + LOCK_AGE_MARGIN_MS ? ID : null;
}
