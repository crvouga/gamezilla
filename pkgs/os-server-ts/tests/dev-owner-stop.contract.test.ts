import { expect, test } from 'bun:test';
import {
  type ChildProcess,
  execFileSync,
  type StdioOptions,
  spawn,
} from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gcDevOwner } from '@pkgs/os-server-ts/dev-owner-gc';
import {
  ownerProcess,
  processSnapshot,
} from '@pkgs/os-server-ts/dev-owner-state';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';

const launcherFixture = join(
  import.meta.dirname,
  'dev-owner-launcher-fixture.ts'
);
const owned = (root: string) =>
  processSnapshot().filter(
    (row) => row.root === root && /(?:bun|node)/.test(row.command)
  );
async function until(check: () => boolean) {
  const deadline = Date.now() + 30000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Process assertion timed out');
    await Bun.sleep(50);
  }
}
const rootDir = () =>
  realpathSync(mkdtempSync(join(tmpdir(), 'dev-owner-stop-')));
const ready = (root: string) => join(root, 'ready-grandchild');

/** The launcher a run script starts: it re-executes itself as the supervisor. */
function launch(root: string, stdio: StdioOptions = 'ignore'): ChildProcess {
  return spawn(process.execPath, [launcherFixture, root], {
    env: { ...process.env, DEV_OWNER_READY_DIR: root },
    stdio,
  });
}
const exitOf = (child: ChildProcess) =>
  new Promise((resolve) => child.once('exit', resolve));
function bootProcess(root: string, script: string) {
  const row = owned(root).find((entry) => entry.command.includes(script));
  if (!row) throw new Error(`No ${script} in the boot`);
  return row;
}
async function discard(root: string, launchers: ChildProcess[]) {
  for (const launcher of launchers) launcher.kill('SIGKILL');
  await gcDevOwner(root, true);
  removeTree(root, { whenLocked: 'leave' });
}

// regression: dev-owner-orphaned-supervisor
test('a supervisor whose launcher is killed stops its boot without the watchdog', async () => {
  const root = rootDir();
  const launcher = launch(root);
  try {
    await until(() => existsSync(ready(root)));
    expect(owned(root)).toHaveLength(5);
    process.kill(bootProcess(root, 'dev-owner-watch.ts').pid, 'SIGKILL');
    const exited = exitOf(launcher);
    launcher.kill('SIGKILL');
    await exited;
    await until(() => owned(root).length === 0);
  } finally {
    await discard(root, [launcher]);
  }
}, 60000);

// regression: dev-owner-stop-blocks-on-terminal
test('a stopping boot reports to the checkout and writes nothing to its launch terminal', async () => {
  const root = rootDir();
  const terminal = join(root, 'terminal');
  const output = openSync(terminal, 'w');
  const launcher = launch(root, ['ignore', output, output]);
  try {
    await until(() => existsSync(ready(root)));
    const exited = exitOf(launcher);
    launcher.kill('SIGTERM');
    await exited;
    expect(owned(root)).toEqual([]);
    expect(readFileSync(terminal, 'utf8')).toBe('');
    expect(
      readFileSync(join(root, '.cache/dev-owner/gc.log'), 'utf8')
    ).toContain('[gc] SIGKILL');
  } finally {
    closeSync(output);
    await discard(root, [launcher]);
  }
}, 60000);

// regression: dev-owner-abandoned-boot-blocks-start
test('a start collects the boot a killed launcher left running and takes its place', async () => {
  const root = rootDir();
  const first = launch(root);
  const launchers = [first];
  try {
    await until(() => existsSync(ready(root)));
    const before = owned(root).map((row) => row.pid);
    expect(before).toHaveLength(5);
    // A supervisor that cannot run any more still holds the checkout's slot.
    process.kill(
      bootProcess(root, 'dev-owner-launcher-fixture.ts').pid,
      'SIGSTOP'
    );
    process.kill(bootProcess(root, 'dev-owner-watch.ts').pid, 'SIGKILL');
    const exited = exitOf(first);
    first.kill('SIGKILL');
    await exited;
    rmSync(ready(root));
    launchers.push(launch(root));
    await until(() => existsSync(ready(root)));
    const after = owned(root).map((row) => row.pid);
    expect(after).toHaveLength(5);
    expect(after.filter((pid) => before.includes(pid))).toEqual([]);
  } finally {
    await discard(root, launchers);
  }
}, 90000);

// regression: dev-owner-zombie-launcher
test('a process that exited but was not reaped by its parent is not alive', async () => {
  // `sleep 0` exits at once; its parent becomes a sleep that never waits for it.
  const parent = spawn('/bin/sh', ['-c', 'sleep 0 & exec sleep 30'], {
    stdio: 'ignore',
  });
  const zombie = () => {
    const line = execFileSync('ps', ['axww', '-o', 'pid=,ppid=,stat='], {
      encoding: 'utf8',
    })
      .split('\n')
      .map((row) => row.trim().split(/\s+/))
      .find(
        ([, ppid, stat]) => ppid === String(parent.pid) && stat?.[0] === 'Z'
      );
    return line ? Number(line[0]) : undefined;
  };
  try {
    await until(() => zombie() !== undefined);
    const pid = zombie() ?? -1;
    expect(processSnapshot().filter((row) => row.pid === pid)).toEqual([]);
    expect(ownerProcess(pid)).toBeUndefined();
  } finally {
    parent.kill('SIGKILL');
  }
}, 30000);
