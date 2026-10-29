import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
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
    removeTree(home, { whenLocked: 'leave' });
  }
});

test('the lease location depends on the user home, not checkout or TMPDIR', () => {
  // A native path: SQLite opens it on the host OS.
  expect(localVerifyLeasePath('/user')).toBe(
    join('/user', '.cache', NAMESPACE, 'local-verify.sqlite')
  );
});
