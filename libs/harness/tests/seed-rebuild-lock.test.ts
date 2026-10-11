import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withSeedRebuildLock } from '@libs/harness/seed-rebuild-lock';

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
    await rm(dir, { recursive: true, force: true });
  }
});

test('a lock left by a dead process is taken over', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'seed-lock-'));
  const lock = join(dir, 'harness-seed.lock');
  try {
    await mkdir(lock);
    await writeFile(join(lock, 'pid'), '2147483646');
    let ran = false;
    await withSeedRebuildLock(dir, 'harness-seed', async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
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
    await rm(dir, { recursive: true, force: true });
  }
});
