import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gcDevOwner } from '@pkgs/os-server-ts/dev-owner-gc';
import { spawnOwned } from '@pkgs/os-server-ts/dev-owner-spawn';
import {
  ownerProcess,
  processSnapshot,
} from '@pkgs/os-server-ts/dev-owner-state';

const fixture = join(import.meta.dirname, 'dev-owner-node-fixture.cjs');
const runFixture = join(import.meta.dirname, 'dev-owner-run-fixture.cjs');
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
const rootDir = () => realpathSync(mkdtempSync(join(tmpdir(), 'dev-owner-')));

// regression: dev-owner-orphan-sessions
test('gc reaps SIGTERM-resistant child and grandchild sessions after SIGKILL, preserving checkout B', async () => {
  const a = rootDir();
  const b = rootDir();
  const launch = (root: string, mode: string) =>
    spawn('node', [fixture, mode], {
      env: {
        ...process.env,
        DEV_OWNER_ROOT: root,
        DEV_OWNER_BOOT: 'orphan-fixture',
        DEV_OWNER_READY_DIR: root,
      },
      detached: true,
      stdio: 'ignore',
    });
  const parent = launch(a, 'parent');
  const foreign = launch(b, 'grandchild');
  try {
    await until(
      () =>
        existsSync(join(a, 'ready-grandchild')) &&
        existsSync(join(b, 'ready-grandchild'))
    );
    expect(owned(a)).toHaveLength(3);
    const exited = new Promise((resolve) => parent.once('exit', resolve));
    parent.kill('SIGKILL');
    await exited;
    expect(owned(a)).toHaveLength(2);
    await gcDevOwner(a);
    expect(owned(a)).toHaveLength(0);
    expect(foreign.pid).toBeDefined();
    expect(owned(b).map((row) => row.pid)).toEqual([foreign.pid ?? -1]);
    await gcDevOwner(a);
    expect(owned(a)).toEqual([]);
  } finally {
    await gcDevOwner(a, true);
    await gcDevOwner(b, true);
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
}, 60000);

// regression: dev-owner-duplicate-boot
test('second start and gc preserve a live boot; watchdog reaps supervisor SIGKILL', async () => {
  const root = rootDir();
  const script = join(import.meta.dirname, 'dev-owner-supervisor-fixture.ts');
  const launch = () =>
    spawn(process.execPath, [script, root], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DEV_OWNER_ROOT: root,
        DEV_OWNER_BOOT: 'supervisor-fixture',
        DEV_OWNER_READY_DIR: root,
      },
    });
  const first = launch();
  try {
    await until(() => existsSync(join(root, 'ready-grandchild')));
    expect(owned(root)).toHaveLength(5);
    expect(
      owned(root).filter((row) => /(?:^|\/)node(?: |$)/.test(row.command))
    ).toHaveLength(3);
    const before = owned(root)
      .map((row) => row.pid)
      .sort();
    const second = launch();
    const code = await new Promise((resolve) => second.once('exit', resolve));
    expect(code).toBe(0);
    await gcDevOwner(root);
    expect(
      owned(root)
        .map((row) => row.pid)
        .sort()
    ).toEqual(before);
    const watcher = owned(root).find((row) =>
      row.command.includes('dev-owner-watch.ts')
    );
    const exited = new Promise((resolve) => first.once('exit', resolve));
    first.kill('SIGKILL');
    await exited;
    expect(watcher).toBeDefined();
    if (!watcher) throw new Error('No boot watchdog');
    await until(() => {
      try {
        process.kill(watcher.pid, 0);
        return false;
      } catch {
        return true;
      }
    });
    expect(owned(root)).toEqual([]);
  } finally {
    first.kill('SIGKILL');
    await gcDevOwner(root, true);
    rmSync(root, { recursive: true, force: true });
  }
}, 60000);

// regression: dev-owner-bunx-subcommand
test('owned bun x executes its native subcommand without treating it as a package script', async () => {
  const root = rootDir();
  const child = spawnOwned('bun', ['x', '--no-install', 'biome', '--version'], {
    env: {
      ...process.env,
      DEV_OWNER_ROOT: root,
      DEV_OWNER_BOOT: 'bunx-fixture',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    output += chunk.toString();
  });
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    expect(code).toBe(0);
    expect(output).toContain('Version:');
  } finally {
    await gcDevOwner(root, true);
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);

// regression: dev-owner-preload-before-run
test('owned bun run keeps leading flags and executes the script', async () => {
  const root = rootDir();
  const child = spawnOwned('bun', ['--no-env-file', 'run', runFixture], {
    env: {
      ...process.env,
      DEV_OWNER_ROOT: root,
      DEV_OWNER_BOOT: 'run-flag-fixture',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    output += chunk.toString();
  });
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    expect(code).toBe(0);
    expect(output).toContain('run-fixture-ok');
    expect(output).not.toContain('Usage: bun run');
  } finally {
    await gcDevOwner(root, true);
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);

// regression: dev-owner-bootstrap-gc-race
test('gc preserves a stamped launch while its original supervisor is alive before boot registration', async () => {
  const root = rootDir();
  const parent = ownerProcess(process.pid);
  if (!parent) throw new Error('No fixture supervisor identity');
  const boot = `launcher-${parent.pid}-${parent.identity.replace(/[^a-zA-Z0-9]/g, '')}`;
  const child = spawnOwned('node', [fixture, 'grandchild'], {
    env: {
      ...process.env,
      DEV_OWNER_ROOT: root,
      DEV_OWNER_BOOT: boot,
      DEV_OWNER_READY_DIR: root,
    },
    stdio: 'ignore',
  });
  try {
    await until(() => existsSync(join(root, 'ready-grandchild')));
    await gcDevOwner(root);
    expect(child.exitCode).toBeNull();
    expect(owned(root).map((row) => row.pid)).toEqual([child.pid ?? -1]);
  } finally {
    await gcDevOwner(root, true);
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
