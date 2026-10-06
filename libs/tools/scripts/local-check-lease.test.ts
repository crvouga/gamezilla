import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localCheckLeasePath, openLocalCheckLease } from './local-check-lease';

// regression: local-check-worktree-memory-contention
test('independent connections share admission and closing an owner recovers its lock', () => {
  const home = mkdtempSync(join(tmpdir(), 'local-check-lease-'));
  const path = localCheckLeasePath(home);
  const a = openLocalCheckLease(path);
  const b = openLocalCheckLease(path);
  const c = openLocalCheckLease(path);
  try {
    expect(a.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(false);
    expect(c.tryAcquire()).toBe(false);
    b.close();
    expect(c.tryAcquire()).toBe(false);
    // Closing a connection releases the same OS lock as process death.
    a.close();
    expect(c.tryAcquire()).toBe(true);
    c.close();
    const next = openLocalCheckLease(path);
    try {
      expect(next.tryAcquire()).toBe(true);
    } finally {
      next.close();
    }
  } finally {
    a.close();
    b.close();
    c.close();
    rmSync(home, { recursive: true, force: true });
  }
});

test('the lease location depends on the user home, not checkout or TMPDIR', () => {
  expect(localCheckLeasePath('/user')).toBe(
    '/user/.cache/gamezilla/local-check.sqlite'
  );
});
