// @io-wall-ok — checkout process ownership adapter; environment values never leave this module.
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { ownerEnvironments } from './dev-owner-environment';

export type OwnedProcess = {
  pid: number;
  ppid: number;
  pgid: number;
  identity: string;
  command: string;
  root: string | null;
  boot: string | null;
  cwd?: string;
};
export type OwnerBoot = {
  id: string;
  root: string;
  supervisor: OwnedProcess;
  launcher?: OwnedProcess | null;
  launchers?: OwnedProcess[];
};
export const ownerDir = (root: string) =>
  join(realpathSync(root), '.cache/dev-owner');

function readPs(args: string[]): string {
  try {
    return execFileSync('ps', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 15000,
    });
  } catch {
    throw new Error('Ownership process snapshot failed; refusing cleanup');
  }
}
const psFields = 'pid=,ppid=,pgid=,stat=,lstart=,command=';
function parseRows(output: string): OwnedProcess[] {
  return output.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.{24})\s+(.*)$/.exec(
      line
    );
    // A zombie has exited: it is a table entry its parent has not read yet.
    if (!match || match[4]?.startsWith('Z')) return [];
    const raw = match[6] ?? '';
    return [
      {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        pgid: Number(match[3]),
        identity: match[5] ?? '',
        command: raw,
        root: null,
        boot: null,
      },
    ];
  });
}
export function ownerProcess(pid: number): OwnedProcess | undefined {
  return parseRows(readPs(['-p', String(pid), '-o', psFields]))[0];
}
export function ownerParents(pid: number): OwnedProcess[] {
  const rows = parseRows(readPs(['axww', '-o', psFields]));
  const parents: OwnedProcess[] = [];
  let current = rows.find((row) => row.pid === pid);
  while (
    current &&
    current.pid > 1 &&
    !parents.some((row) => row.pid === current?.pid)
  ) {
    parents.push(current);
    current = rows.find((row) => row.pid === current?.ppid);
  }
  return parents;
}
export function processSnapshot(): OwnedProcess[] {
  const rows = parseRows(readPs(['axww', '-o', psFields]));
  const stamps = ownerEnvironments(
    rows.map((row) => row.pid).filter((pid) => pid > 1)
  );
  return rows.map((row) => ({
    ...row,
    root: stamps.get(row.pid)?.root ?? null,
    boot: stamps.get(row.pid)?.boot ?? null,
    ...(stamps.get(row.pid)?.cwd ? { cwd: stamps.get(row.pid)!.cwd! } : {}),
  }));
}

export function writeOwnerRecord(
  root: string,
  name: string,
  value: unknown
): void {
  const dir = ownerDir(root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value));
  renameSync(temp, path);
}

export function ownerRecords<T>(root: string, prefix: string): T[] {
  mkdirSync(ownerDir(root), { recursive: true });
  return readdirSync(ownerDir(root))
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .flatMap((name) => {
      try {
        return [
          JSON.parse(readFileSync(join(ownerDir(root), name), 'utf8')) as T,
        ];
      } catch {
        return [];
      }
    });
}

export function recordOwned(root: string, rows = processSnapshot()): void {
  const existing = ownerRecords<OwnedProcess>(root, 'pid-');
  for (const row of rows) {
    if (row.root !== root || row.pid <= 1 || row.command.startsWith('ps '))
      continue;
    const previous = existing.find((entry) => sameProcess(entry, row));
    const cwd = row.cwd ?? previous?.cwd ?? root;
    writeOwnerRecord(root, `pid-${row.pid}.json`, {
      ...row,
      cwd: cwd ?? root,
      stamp: { DEV_OWNER_ROOT: root, DEV_OWNER_BOOT: row.boot },
    });
  }
}
export const sameProcess = (a: OwnedProcess, b: OwnedProcess) =>
  a.pid === b.pid && a.identity === b.identity;

/** Attended while its supervisor and every process that launched it are alive. */
export function bootAttended(boot: OwnerBoot, rows: OwnedProcess[]): boolean {
  const alive = (owner: OwnedProcess) =>
    rows.some((row) => sameProcess(row, owner));
  return (
    alive(boot.supervisor) &&
    (!boot.launcher || alive(boot.launcher)) &&
    (boot.launchers ?? []).every(alive)
  );
}

const OWNER_LOG_BYTES = 1_000_000;
/**
 * The checkout's own cleanup record. A boot that is stopping writes here and
 * never to its launch terminal: nobody may be reading that terminal any more,
 * and a write to it would then wait forever.
 */
export function ownerLog(root: string): (line: string) => void {
  const path = join(ownerDir(root), 'gc.log');
  return (line) => {
    try {
      mkdirSync(ownerDir(root), { recursive: true });
      try {
        if (statSync(path).size > OWNER_LOG_BYTES)
          renameSync(path, `${path}.1`);
      } catch {
        /* first record */
      }
      appendFileSync(path, line);
    } catch {
      /* the record is best effort; cleanup goes on without it */
    }
  };
}
