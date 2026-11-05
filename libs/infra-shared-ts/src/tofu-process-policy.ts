import { type TofuPaths, varFileArgs } from './tofu-command';

/** Interrupt OpenTofu so its deferred state-lock cleanup can run. */
export function toolDeadline(operation: string) {
  return operation === 'apply'
    ? {}
    : { timeout: 180_000, killSignal: 'SIGINT' as const };
}

/** Recovery requires the exact lock identity observed on a completed runner. */
export function repositoryUnlockArgs(
  lockId: string,
  paths: TofuPaths
): readonly string[] {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      lockId
    )
  )
    throw new Error('Supply the exact abandoned OpenTofu lock UUID');
  return [
    'force-unlock',
    '-force',
    ...varFileArgs(paths, { stack: 'bootstrap', env: null }),
    lockId,
  ];
}
