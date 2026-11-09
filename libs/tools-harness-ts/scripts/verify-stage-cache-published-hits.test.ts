import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { ensurePublishedHits } from './verify-stage-cache';

type Hit = Parameters<typeof ensurePublishedHits>[0][number];
const hit = {
  taskId: '@pkgs/ui-quality-check-server-ts#build',
  hash: '08d000e88697c7cf',
} as Hit;

function cache(): string {
  return mkdtempSync(
    join(process.env['TMPDIR'] ?? tmpdir(), 'published-hits-')
  );
}

// regression: verify-published-hit-left-for-turbo
test('a published cache hit the first prefetch missed is fetched again before the stage runs', async () => {
  const dir = cache();
  try {
    const timeouts: number[] = [];
    await ensurePublishedHits(
      [hit],
      dir,
      async (tasks, timeoutMs) => {
        timeouts.push(timeoutMs);
        // The first retry times out again; the second arrives.
        if (timeouts.length === 2)
          for (const task of tasks)
            writeFileSync(join(dir, `${task.hash}.tar.zst`), 'artifact');
      },
      [1, 2, 3]
    );
    expect(timeouts).toEqual([1, 2]);
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
});

test('a published cache hit that never arrives fails the producer by name', async () => {
  const dir = cache();
  try {
    await expect(
      ensurePublishedHits([hit], dir, async () => undefined, [1, 2])
    ).rejects.toThrow('@pkgs/ui-quality-check-server-ts#build');
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
});
