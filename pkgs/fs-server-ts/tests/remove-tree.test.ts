import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REMOVE_ATTEMPTS, removeTree } from '@pkgs/fs-server-ts/remove-tree';

function failure(code: string): Error {
  return Object.assign(new Error(`${code}: simulated`), { code });
}

/** A remove that fails `failures` times with `code`, then succeeds. */
function ports(failures: number, code = 'EBUSY') {
  const calls = { removed: 0, slept: [] as number[], warned: [] as string[] };
  return {
    calls,
    ports: {
      remove: () => {
        calls.removed += 1;
        if (calls.removed <= failures) throw failure(code);
      },
      sleep: (ms: number) => {
        calls.slept.push(ms);
      },
      warn: (message: string) => {
        calls.warned.push(message);
      },
    },
  };
}

// regression: release-journeys-teardown-ebusy
test('a tree Windows still holds is removed once the locks go, without a warning', () => {
  // Verify run 40769518282: every scenario passed, then the stack's data
  // directory was EBUSY and the throw made the task exit 1.
  const { calls, ports: io } = ports(3);
  removeTree('stack-data', { ports: io });
  expect(calls.removed).toBe(4);
  expect(calls.slept).toHaveLength(3);
  expect(calls.warned).toEqual([]);
});

test.each(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'])(
  'a %s lock is waited out',
  (code) => {
    const { calls, ports: io } = ports(1, code);
    removeTree('stack-data', { ports: io });
    expect(calls.removed).toBe(2);
  }
);

test('scratch that stays locked is reported and left when the caller asks, never thrown', () => {
  const { calls, ports: io } = ports(Number.POSITIVE_INFINITY);
  removeTree('stack-data', { whenLocked: 'leave', ports: io });
  expect(calls.removed).toBe(REMOVE_ATTEMPTS);
  expect(calls.slept).toHaveLength(REMOVE_ATTEMPTS - 1);
  expect(calls.warned).toHaveLength(1);
  expect(calls.warned[0]).toContain('stack-data');
});

test('a tree the caller is about to rebuild that stays locked is an error', () => {
  const { calls, ports: io } = ports(Number.POSITIVE_INFINITY);
  expect(() => removeTree('report', { ports: io })).toThrow('EBUSY');
  expect(calls.removed).toBe(REMOVE_ATTEMPTS);
  expect(calls.warned).toEqual([]);
});

test('a failure that is not a lock is thrown at once, not retried', () => {
  const { calls, ports: io } = ports(1, 'EINVAL');
  expect(() =>
    removeTree('stack-data', { whenLocked: 'leave', ports: io })
  ).toThrow('EINVAL');
  expect(calls).toEqual({ removed: 1, slept: [], warned: [] });
});

test('an unlocked tree is removed at once', () => {
  const { calls, ports: io } = ports(0);
  removeTree('stack-data', { ports: io });
  expect(calls).toEqual({ removed: 1, slept: [], warned: [] });
});

test('a real tree is removed, and a missing one is not an error', () => {
  const root = mkdtempSync(join(tmpdir(), 'remove-tree-'));
  mkdirSync(join(root, 'a', 'b'), { recursive: true });
  writeFileSync(join(root, 'a', 'b', 'file.txt'), 'x');
  removeTree(root);
  expect(existsSync(root)).toBe(false);
  removeTree(root);
});
