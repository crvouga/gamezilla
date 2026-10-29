// @io-wall-ok — specialized cleanup shares checkout stamps and process identities with GC.
import { realpathSync } from 'node:fs';
import { processSnapshot } from './dev-owner-state';

export type KillEsbuildServicesOptions = {
  readonly commandIncludes: string;
  /** Host platform; injectable so the Windows branch is testable anywhere. */
  readonly platform?: NodeJS.Platform;
};

function collect(
  options: KillEsbuildServicesOptions,
  orphanOnly: boolean
): void {
  const root =
    process.env['DEV_OWNER_ROOT'] ?? realpathSync(options.commandIncludes);
  for (const row of processSnapshot()) {
    if (row.pid <= 1 || row.pid === process.pid) continue;
    if (row.root !== null && row.root !== root) continue;
    if (!row.command.includes(options.commandIncludes)) continue;
    if (!row.command.includes('esbuild') || !row.command.includes('--service'))
      continue;
    if (orphanOnly && row.ppid !== 1) continue;
    process.stdout.write(
      `[gc] SIGKILL pid=${row.pid} boot=${row.boot ?? 'legacy'} ${row.command}\n`
    );
    try {
      process.kill(row.pid, 'SIGKILL');
    } catch {
      /* exited */
    }
  }
}
/**
 * Orphaned esbuild services are a POSIX artifact: a dead parent reparents its
 * `esbuild --service` child to pid 1, and the cleanup finds it with `ps`.
 * Windows has neither reparenting to pid 1 nor `ps`, so there is nothing to
 * collect and the snapshot would only fail.
 */
function posixHost(options: KillEsbuildServicesOptions): boolean {
  return (options.platform ?? process.platform) !== 'win32';
}
export function killOrphanEsbuildServices(
  options: KillEsbuildServicesOptions
): void {
  if (posixHost(options)) collect(options, true);
}
export function killAllEsbuildServices(
  options: KillEsbuildServicesOptions
): void {
  if (posixHost(options)) collect(options, false);
}
