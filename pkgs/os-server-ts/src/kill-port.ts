// @io-wall-ok — port cleanup refuses listeners without checkout ownership evidence.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import {
  type OwnedProcess,
  ownerRecords,
  processSnapshot,
  sameProcess,
} from './dev-owner-state';

function eligibleListener(
  row: OwnedProcess | undefined,
  root: string,
  ledger: OwnedProcess[]
): boolean {
  if (!row || row.pid <= 1 || row.pid === process.pid) return false;
  if (row.root !== null && row.root !== root) return false;
  const record = ledger.find((entry) => sameProcess(entry, row));
  return (
    row.root === root ||
    record?.root === root ||
    row.command.includes(`${root}/`)
  );
}

export function killListenersOnPorts(ports: readonly number[]): void {
  const root =
    process.env['DEV_OWNER_ROOT'] ??
    realpathSync(
      execFileSync('git', ['rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
      }).trim()
    );
  const ledger = ownerRecords<OwnedProcess>(root, 'pid-');
  const rows = processSnapshot();
  for (const port of ports) {
    let output: string;
    try {
      output = execFileSync(
        'lsof',
        ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }
      );
    } catch {
      continue;
    }
    for (const pid of output.trim().split(/\s+/).map(Number)) {
      const row = rows.find((entry) => entry.pid === pid);
      if (!eligibleListener(row, root, ledger)) continue;
      if (!row) continue;
      const record = ledger.find((entry) => sameProcess(entry, row));
      process.stdout.write(
        `[gc] SIGKILL pid=${pid} boot=${row.boot ?? record?.boot ?? 'legacy'} ${row.command}\n`
      );
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* exited */
      }
    }
  }
}
