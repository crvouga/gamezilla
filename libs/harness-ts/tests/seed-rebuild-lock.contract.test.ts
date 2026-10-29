import { expect, test } from 'bun:test';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withSeedRebuildLock } from '@libs/harness-ts/seed-rebuild-lock';
import { spawnOwned } from '@pkgs/dev-owner-server-ts/dev-owner-spawn';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

// regression: harness-seed-lock-release-race
// regression: harness-seed-release-reclaims-live-waiter
// regression: harness-seed-rebuild-stampede
test('one process rebuilds a seed while another waits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seed-lock-'));
  try {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inside = 0;
    let overlap = 0;
    const first = withSeedRebuildLock(dir, 'harness-seed', async () => {
      inside += 1;
      overlap = Math.max(overlap, inside);
      await held;
      inside -= 1;
    });
    while (inside === 0) await Bun.sleep(5);
    const second = withSeedRebuildLock(dir, 'harness-seed', async () => {
      inside += 1;
      overlap = Math.max(overlap, inside);
      inside -= 1;
    });
    expect(inside).toBe(1);
    release();
    await Promise.all([first, second]);
    expect(overlap).toBe(1);
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
});

test('a lock held by a terminated process is released by the OS', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seed-lock-'));
  const lock = join(dir, 'harness-seed.lock.sqlite');
  const child = spawnOwned(
    'bun',
    [
      '--eval',
      'import { Database } from "bun:sqlite"; const db = new Database(process.argv[1], { create: true }); db.run("BEGIN EXCLUSIVE"); process.stdout.write("held"); await new Promise(() => {});',
      lock,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  try {
    await once(child.stdout!, 'data');
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    let ran = false;
    await withSeedRebuildLock(dir, 'harness-seed', async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  } finally {
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
    removeTree(dir, { whenLocked: 'leave' });
  }
});

// regression: harness-seed-lock-missing-cache-dir
test('a checkout with no cache directory still rebuilds its seed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seed-lock-'));
  // Literal failing input: `<package>/.cache` absent, as in a fresh checkout.
  const cache = join(dir, '.cache');
  try {
    let ran = false;
    await withSeedRebuildLock(
      cache,
      'harness-seed-wire-isolation',
      async () => {
        ran = true;
      }
    );
    expect(ran).toBe(true);
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
});

test('a failed builder releases its lease for the next rebuild', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seed-lock-'));
  try {
    await expect(
      withSeedRebuildLock(dir, 'harness-seed', async () => {
        throw new Error('Build interrupted');
      })
    ).rejects.toThrow('Build interrupted');
    let ran = false;
    await withSeedRebuildLock(dir, 'harness-seed', async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
});
