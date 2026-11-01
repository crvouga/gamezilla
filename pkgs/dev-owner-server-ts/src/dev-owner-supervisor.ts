// @io-wall-ok — boot admission and lifetime are held by the existing launcher.
import { Database } from 'bun:sqlite';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { gcDevOwner } from './dev-owner-gc';
import { spawnOwned } from './dev-owner-spawn';
import {
  bootAttended,
  type OwnedProcess,
  type OwnerBoot,
  ownerDir,
  ownerLog,
  ownerProcess,
  ownerRecords,
  processSnapshot,
  sameProcess,
  writeOwnerRecord,
} from './dev-owner-state';

const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
const ORPHAN_POLL_MS = 1000;
const LEASE_RELEASE_POLL_MS = 100;
const LEASE_RELEASE_POLLS = 50;

function acquire(lease: Database): boolean {
  try {
    lease.run('BEGIN EXCLUSIVE');
    return true;
  } catch {
    return false;
  }
}

/** A supervisor still runs for a boot whose launcher is gone: nobody attends it. */
function heldByAbandonedBoot(root: string): boolean {
  const rows = processSnapshot();
  return ownerRecords<OwnerBoot>(root, 'boot-').some(
    (boot) =>
      rows.some((row) => sameProcess(row, boot.supervisor)) &&
      !bootAttended(boot, rows)
  );
}

/** The checkout's one boot slot. An abandoned boot holding it is collected first. */
async function admit(root: string): Promise<Database | null> {
  const lease = new Database(join(ownerDir(root), 'lease.sqlite'), {
    create: true,
  });
  if (acquire(lease)) return lease;
  if (heldByAbandonedBoot(root)) {
    process.stdout.write(
      '[dev] Stopping the boot an earlier launch left behind.\n'
    );
    await gcDevOwner(root);
    // The OS releases the lock as the collected supervisor exits.
    for (let poll = 0; poll < LEASE_RELEASE_POLLS; poll += 1) {
      if (acquire(lease)) return lease;
      await Bun.sleep(LEASE_RELEASE_POLL_MS);
    }
  }
  lease.close();
  return null;
}

async function runBoot(
  root: string,
  command: string,
  args: readonly string[],
  extraEnv: NodeJS.ProcessEnv
): Promise<number> {
  const supervisor = ownerProcess(process.pid);
  if (!supervisor) throw new Error('Cannot identify supervisor');
  const boot =
    process.env['DEV_OWNER_BOOT'] ??
    `${process.pid}-${supervisor.identity.replace(/[^a-zA-Z0-9]/g, '')}`;
  const launcher: OwnedProcess | null = process.env['DEV_OWNER_LAUNCHER']
    ? (JSON.parse(process.env['DEV_OWNER_LAUNCHER']) as OwnedProcess)
    : null;
  writeOwnerRecord(root, `boot-${boot}.json`, {
    id: boot,
    root,
    supervisor,
    launcher,
    launchers: JSON.parse(process.env['DEV_OWNER_LAUNCHERS'] ?? '[]'),
  });
  const env = {
    ...process.env,
    ...extraEnv,
    DEV_OWNER_ROOT: root,
    DEV_OWNER_BOOT: boot,
  };
  const watchdog = spawnOwned(
    process.execPath,
    [join(import.meta.dirname, 'dev-owner-watch.ts')],
    { cwd: root, env, stdio: 'inherit' }
  );
  // Ownership belongs to the checkout; relative command inputs belong to the caller.
  const child = spawnOwned(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });
  const done = new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  // A stopping boot reports to the checkout, never to its launch terminal.
  const report = ownerLog(root);
  const collect = (reason: string) => {
    report(`[dev] boot=${boot} stopping: ${reason}\n`);
    return gcDevOwner(root, true, boot, report);
  };
  let stopping: Promise<void> | undefined;
  const stop = (reason: string) => {
    stopping ??= collect(reason);
  };
  for (const signal of STOP_SIGNALS) process.on(signal, stop);
  // A launcher killed outright forwards no signal; the kernel only hands this
  // process to another parent.
  const parent = process.ppid;
  let finished = false;
  const watchLauncher = async () => {
    while (!finished) {
      if (process.ppid !== parent) return stop('launcher exited');
      await Bun.sleep(ORPHAN_POLL_MS);
    }
  };
  if (launcher?.pid === parent) void watchLauncher();
  try {
    return await done;
  } finally {
    finished = true;
    await (stopping ?? collect('command exited'));
    watchdog.kill('SIGTERM');
    for (const signal of STOP_SIGNALS) process.off(signal, stop);
  }
}

export async function superviseDev(
  checkout: string,
  command: string,
  args: readonly string[],
  extraEnv: NodeJS.ProcessEnv = {}
): Promise<number> {
  const root = realpathSync(checkout);
  mkdirSync(ownerDir(root), { recursive: true });
  const lease = await admit(root);
  if (!lease) {
    process.stdout.write(
      '[dev] This checkout already has a live boot; reusing it.\n'
    );
    return 0;
  }
  try {
    await gcDevOwner(root);
    return await runBoot(root, command, args, extraEnv);
  } finally {
    lease.close();
  }
}
