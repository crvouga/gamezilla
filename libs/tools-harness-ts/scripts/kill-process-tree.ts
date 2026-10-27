// @io-wall-ok — process cancellation snapshots detached descendants before stopping their root.
import { execFileSync } from 'node:child_process';
import { parsePs } from './running-tasks';

/** Children first, including descendants which started their own process group. */
export function descendantPids(
  rows: readonly { readonly pid: number; readonly ppid: number }[],
  rootPid: number
): readonly number[] {
  const children = new Map<number, number[]>();
  for (const row of rows) {
    const siblings = children.get(row.ppid) ?? [];
    siblings.push(row.pid);
    children.set(row.ppid, siblings);
  }
  const found = [rootPid];
  const seen = new Set(found);
  for (const pid of found) {
    for (const child of children.get(pid) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      found.push(child);
    }
  }
  return found.reverse();
}

type RunCommand = (file: string, args: readonly string[]) => void;

const runQuietly: RunCommand = (file, args) => {
  execFileSync(file, args, { stdio: 'ignore', windowsHide: true });
};

/**
 * Windows has no process groups to signal and no `ps`; `taskkill /T` walks the
 * tree by parent pid and `/F` terminates it. Windows cannot deliver a
 * catchable SIGTERM to a console process, so every signal is a hard kill.
 */
export function killWindowsProcessTree(
  pid: number,
  run: RunCommand = runQuietly
): void {
  try {
    run('taskkill', ['/PID', String(pid), '/T', '/F']);
  } catch {
    /* Already exited: taskkill reports the pid as not found. */
  }
}

export function killProcessTree(
  pid: number,
  signal: NodeJS.Signals,
  platform: NodeJS.Platform = process.platform
): void {
  if (platform === 'win32') {
    killWindowsProcessTree(pid);
    return;
  }
  let descendants: readonly number[] = [pid];
  try {
    const output = execFileSync('ps', ['-axo', 'pid=,ppid=,etime=,command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    descendants = descendantPids(parsePs(output), pid);
  } catch {
    // The root process group remains the fallback on hosts without ps.
  }
  for (const child of descendants) {
    try {
      process.kill(child, signal);
    } catch {
      /* Already exited. */
    }
  }
  try {
    process.kill(-pid, signal);
  } catch {
    /* Already exited. */
  }
}
