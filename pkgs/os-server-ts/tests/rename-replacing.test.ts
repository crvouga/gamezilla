import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RENAME_ATTEMPTS,
  renameReplacing,
} from '@pkgs/os-server-ts/rename-replacing';

function failure(code: string): Error {
  return Object.assign(new Error(`${code}: simulated`), { code });
}

function ports(failures: number, code = 'EPERM') {
  const calls = { renamed: 0, slept: 0 };
  return {
    calls,
    ports: {
      rename: () => {
        calls.renamed += 1;
        if (calls.renamed <= failures) throw failure(code);
      },
      sleep: () => {
        calls.slept += 1;
      },
    },
  };
}

test('a destination another process holds is replaced once it lets go', () => {
  const { calls, ports: io } = ports(3);
  renameReplacing('a.tmp', 'a', io);
  expect(calls).toEqual({ renamed: 4, slept: 3 });
});

test('a lock that outlasts every attempt is an error, not a silent skip', () => {
  const { calls, ports: io } = ports(Number.POSITIVE_INFINITY, 'EBUSY');
  expect(() => renameReplacing('a.tmp', 'a', io)).toThrow('EBUSY');
  expect(calls.renamed).toBe(RENAME_ATTEMPTS);
});

test('a failure that is not a lock is thrown at once', () => {
  const { calls, ports: io } = ports(1, 'ENOENT');
  expect(() => renameReplacing('a.tmp', 'a', io)).toThrow('ENOENT');
  expect(calls).toEqual({ renamed: 1, slept: 0 });
});

test('a real file replaces the one at its destination', () => {
  const root = mkdtempSync(join(tmpdir(), 'rename-replacing-'));
  writeFileSync(join(root, 'a'), 'old');
  writeFileSync(join(root, 'a.tmp'), 'new');
  renameReplacing(join(root, 'a.tmp'), join(root, 'a'));
  expect(readFileSync(join(root, 'a'), 'utf8')).toBe('new');
  expect(existsSync(join(root, 'a.tmp'))).toBe(false);
});
