/**
 * Name the turbo tasks still running when the run deadline kills turbo.
 *
 * The deadline SIGKILLs the turbo process group, so turbo itself prints
 * nothing and writes no run summary; with `errors-only` output a killed Verification
 * run otherwise says only "deadline reached", and nobody can tell a wedged
 * task from a run that simply had too much to do. This snapshots the process
 * tree just before the kill: every process whose parent is the turbo binary
 * is one running task, and its working directory is the package it runs in.
 */
import { execFileSync } from 'node:child_process';
import { readlinkSync } from 'node:fs';
import { relative } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

export type PsRow = {
  readonly pid: number;
  readonly ppid: number;
  /** `ps` `etime`: `[[dd-]hh:]mm:ss`. */
  readonly elapsed: string;
  readonly command: string;
};

export type RunningTask = {
  readonly pid: number;
  readonly elapsed: string;
  readonly command: string;
};

/** Parse `ps -axo pid=,ppid=,etime=,command=`. */
export function parsePs(output: string): PsRow[] {
  const rows: PsRow[] = [];
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (match === null) continue;
    rows.push({
      pid: Number.parseInt(match[1] ?? '', 10),
      ppid: Number.parseInt(match[2] ?? '', 10),
      elapsed: match[3] ?? '',
      command: (match[4] ?? '').trim(),
    });
  }
  return rows;
}

/** The turbo Go binary (not the npm shim that spawned it). */
function isTurboRun(command: string): boolean {
  return /(^|\/)turbo(\s|$)/.test(command) && /\srun(\s|$)/.test(command);
}

/**
 * Tasks running under `rootPid` (the process turbo-ci-run spawned): the
 * children of the turbo binary somewhere beneath it.
 */
export function runningTasks(
  rows: readonly PsRow[],
  rootPid: number
): RunningTask[] {
  const children = new Map<number, PsRow[]>();
  for (const row of rows) {
    const siblings = children.get(row.ppid) ?? [];
    siblings.push(row);
    children.set(row.ppid, siblings);
  }
  const tasks: RunningTask[] = [];
  const root = rows.find((row) => row.pid === rootPid);
  const queue: PsRow[] = root === undefined ? [] : [root];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const kids = children.get(next.pid) ?? [];
    // The npm shim is also `turbo run`; only the innermost one runs tasks.
    const innermostTurbo =
      isTurboRun(next.command) && !kids.some((kid) => isTurboRun(kid.command));
    if (innermostTurbo) {
      for (const kid of kids) {
        tasks.push({
          pid: kid.pid,
          elapsed: kid.elapsed,
          command: kid.command,
        });
      }
    } else {
      queue.push(...kids);
    }
  }
  return tasks;
}

export function formatRunningTasks(
  tasks: readonly (RunningTask & { readonly dir: string | null })[]
): string {
  if (tasks.length === 0) {
    return 'turbo-ci-run: no task was running at the deadline (turbo itself was stuck, or between tasks).';
  }
  const lines = tasks.map(
    (task) =>
      `  ${task.elapsed.padStart(8)}  ${task.dir ?? '?'}  ${task.command}`
  );
  return [
    'turbo-ci-run: tasks still running at the deadline (elapsed, package, command):',
    ...lines,
  ].join('\n');
}

/**
 * Working directory of `pid` relative to `repoRoot`, or `null` when the
 * platform will not say (`/proc` on Linux, `lsof` on macOS).
 */
function cwdOf(pid: number, repoRoot: string): string | null {
  let cwd: string | null = null;
  try {
    cwd = readlinkSync(`/proc/${String(pid)}/cwd`);
  } catch {
    try {
      const out = execFileSync(
        'lsof',
        ['-a', '-d', 'cwd', '-p', String(pid), '-Fn'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const line = out.split('\n').find((l) => l.startsWith('n'));
      cwd = line === undefined ? null : line.slice(1);
    } catch {
      cwd = null;
    }
  }
  if (cwd === null) return null;
  const rel = slashPath(relative(repoRoot, cwd));
  return rel === '' ? '//' : rel;
}

/** Snapshot and describe the tasks under `rootPid`; never throws. */
export function describeRunningTasks(
  rootPid: number,
  repoRoot: string
): string {
  let output: string;
  try {
    output = execFileSync('ps', ['-axo', 'pid=,ppid=,etime=,command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    return `turbo-ci-run: could not list running tasks (${String(error)}).`;
  }
  const tasks = runningTasks(parsePs(output), rootPid).map((task) => ({
    ...task,
    dir: cwdOf(task.pid, repoRoot),
  }));
  return formatRunningTasks(tasks);
}
