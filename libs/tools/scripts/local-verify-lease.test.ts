import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  localVerifyLeasePath,
  openLocalVerifyLease,
} from './local-verify-lease';

// regression: local-verify-worktree-memory-contention
test('independent connections share admission and closing an owner recovers its lock', () => {
  const home = mkdtempSync(join(tmpdir(), 'local-verify-lease-'));
  const path = localVerifyLeasePath(home);
  const a = openLocalVerifyLease(path);
  const b = openLocalVerifyLease(path);
  const c = openLocalVerifyLease(path);
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
    const next = openLocalVerifyLease(path);
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
  expect(localVerifyLeasePath('/user')).toBe(
    '/user/.cache/gamezilla/local-verify.sqlite'
  );
});
