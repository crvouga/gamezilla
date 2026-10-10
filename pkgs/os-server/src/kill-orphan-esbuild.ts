// @io-wall-ok — specialized cleanup shares checkout stamps and process identities with GC.
import { realpathSync } from 'node:fs';
import { processSnapshot } from './dev-owner-state';

export type KillEsbuildServicesOptions = { readonly commandIncludes: string };
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
export function killOrphanEsbuildServices(
  options: KillEsbuildServicesOptions
): void {
  collect(options, true);
}
export function killAllEsbuildServices(
  options: KillEsbuildServicesOptions
): void {
  collect(options, false);
}
