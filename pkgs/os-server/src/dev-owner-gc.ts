// @io-wall-ok — signals only checkout-owned processes, including reparented session leaders.
import { realpathSync } from 'node:fs';
import { stopDevResources } from './dev-owner-resources';
import {
  bootAttended,
  type OwnedProcess,
  type OwnerBoot,
  ownerRecords,
  processSnapshot,
  sameProcess,
} from './dev-owner-state';

type Report = (line: string) => void;
const toStdout: Report = (line) => {
  process.stdout.write(line);
};

type Selection = {
  root: string;
  rows: OwnedProcess[];
  ledger: OwnedProcess[];
  excluded: Set<number>;
  live: Set<string>;
  intentional: boolean;
  onlyBoot?: string | undefined;
};
function candidates(context: Selection): Map<number, OwnedProcess> {
  const { root, rows, ledger, excluded, live, intentional, onlyBoot } = context;
  const selected = new Map<number, OwnedProcess>();
  for (const row of rows) {
    if (excluded.has(row.pid) || (row.root !== null && row.root !== root))
      continue;
    const record = ledger.find((entry) => sameProcess(entry, row));
    if (row.command.includes('dev-owner-gate') && row.root === null && !record)
      continue;
    const boot = row.boot ?? record?.boot ?? null;
    if (onlyBoot !== undefined && boot !== onlyBoot) continue;
    if (!intentional && boot !== null && live.has(boot)) continue;
    const legacy =
      row.command.includes(`${root}/`) &&
      /(?:bun|node|tsx|pnpm|npm|esbuild|vite|next|expo|java|postgres|ffmpeg|chrom)/i.test(
        row.command
      );
    if (row.root === root || record?.root === root || legacy)
      selected.set(row.pid, { ...row, boot });
  }
  return selected;
}

function pendingBoots(
  root: string,
  rows: OwnedProcess[],
  boots: OwnerBoot[]
): Set<string> {
  const pending = new Set<string>();
  for (const row of rows) {
    if (
      row.root !== root ||
      !row.boot ||
      boots.some((boot) => boot.id === row.boot)
    )
      continue;
    const launcher = /^launcher-(\d+)-(.+)$/.exec(row.boot);
    if (!launcher) continue;
    const parent = rows.find((entry) => entry.pid === Number(launcher[1]));
    if (parent?.identity.replace(/[^a-zA-Z0-9]/g, '') === launcher[2])
      pending.add(row.boot);
  }
  return pending;
}

function selectOwned(
  root: string,
  rows: OwnedProcess[],
  intentional: boolean,
  onlyBoot?: string
): OwnedProcess[] {
  const boots = ownerRecords<OwnerBoot>(root, 'boot-');
  // A boot whose launcher is gone is abandoned, its supervisor included.
  const live = new Set(
    boots.filter((boot) => bootAttended(boot, rows)).map((boot) => boot.id)
  );
  for (const boot of pendingBoots(root, rows, boots)) live.add(boot);
  const ledger = ownerRecords<OwnedProcess>(root, 'pid-');
  const excluded = new Set([process.pid, 0, 1]);
  let ancestor = rows.find((row) => row.pid === process.pid);
  while (ancestor && !excluded.has(ancestor.ppid)) {
    excluded.add(ancestor.ppid);
    ancestor = rows.find((row) => row.pid === ancestor?.ppid);
  }
  const selected = candidates({
    root,
    rows,
    ledger,
    excluded,
    live,
    intentional,
    onlyBoot,
  });
  // Snapshot descendants before signalling; never cross an explicit foreign stamp.
  for (const parent of selected.values()) {
    for (const row of rows) {
      if (
        row.ppid !== parent.pid ||
        excluded.has(row.pid) ||
        selected.has(row.pid)
      )
        continue;
      if (row.root !== null && row.root !== root) continue;
      selected.set(row.pid, { ...row, boot: parent.boot });
    }
  }
  return childrenFirst([...selected.values()]);
}

function childrenFirst(rows: OwnedProcess[]): OwnedProcess[] {
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const depth = (row: OwnedProcess) => {
    const seen = new Set<number>();
    let parent = byPid.get(row.ppid);
    while (parent && !seen.has(parent.pid)) {
      seen.add(parent.pid);
      parent = byPid.get(parent.ppid);
    }
    return seen.size;
  };
  return rows.sort((a, b) => depth(b) - depth(a));
}

function signalRows(
  rows: OwnedProcess[],
  signal: NodeJS.Signals,
  current: OwnedProcess[],
  report: Report
): void {
  const targets = new Map(rows.map((row) => [row.pid, row]));
  const groups = new Set(
    rows.map((row) => row.pgid).filter((pgid) => pgid > 1)
  );
  for (const group of groups) {
    const members = current.filter((row) => row.pgid === group);
    if (
      !members.length ||
      members.some(
        (row) =>
          !targets.has(row.pid) ||
          (row.root !== null && row.root !== targets.get(row.pid)?.root)
      )
    )
      continue;
    try {
      process.kill(-group, signal);
    } catch {
      /* exited */
    }
  }
  for (const row of rows) {
    const now = current.find((entry) => sameProcess(entry, row));
    if (!now || (now.root !== null && now.root !== row.root)) continue;
    report(
      `[gc] ${signal} pid=${row.pid} boot=${row.boot ?? 'legacy'} ${row.command}\n`
    );
    try {
      process.kill(row.pid, signal);
    } catch {
      /* exited */
    }
  }
}

export async function gcDevOwner(
  checkout: string,
  intentional = false,
  onlyBoot?: string,
  report: Report = toStdout
): Promise<void> {
  const root = realpathSync(checkout);
  const snapshot = processSnapshot();
  const rows = selectOwned(root, snapshot, intentional, onlyBoot);
  const liveBoots = ownerRecords<OwnerBoot>(root, 'boot-')
    .filter((boot) => bootAttended(boot, snapshot))
    .map((boot) => boot.id);
  const eligible = (id: string) =>
    (onlyBoot === undefined || id === onlyBoot) &&
    (intentional || !liveBoots.includes(id));
  if (!rows.length) {
    stopDevResources(root, eligible);
    return;
  }
  signalRows(rows, 'SIGTERM', snapshot, report);
  await Bun.sleep(2000);
  // Include processes born during shutdown as well as the original snapshot.
  const remaining = processSnapshot();
  const targets = [
    ...new Map(
      [...rows, ...selectOwned(root, remaining, intentional, onlyBoot)].map(
        (row) => [row.pid, row]
      )
    ).values(),
  ];
  signalRows(targets, 'SIGKILL', remaining, report);
  stopDevResources(root, eligible);
}
