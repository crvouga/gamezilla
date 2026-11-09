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
