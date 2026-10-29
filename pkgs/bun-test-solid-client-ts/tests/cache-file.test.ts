/**
 * Windows refuses `rename` onto a transform cache entry another test worker is
 * replacing or reading (`EPERM`), so a realm that missed the cache at the same
 * moment as its sibling failed to load its screens there while POSIX replaced
 * the entry atomically. A busy entry is already (being) filled with the same
 * bytes, so the miss must still succeed and leave no tmp file behind.
 */
import { afterEach, expect, test } from 'bun:test';
import * as nodeFs from 'node:fs';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CacheFileFs,
  publishCacheFile,
} from '@pkgs/bun-test-solid-client-ts/cache-file';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) removeTree(dir, { whenLocked: 'leave' });
});

function cacheDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bun-test-solid-cache-'));
  dirs.push(dir);
  return dir;
}

function refusingRename(code: string): CacheFileFs {
  return {
    writeFileSync: nodeFs.writeFileSync,
    rmSync: nodeFs.rmSync,
    renameSync(from) {
      throw Object.assign(
        new Error(`${code}: operation not permitted, rename '${from}'`),
        { code }
      );
    },
  };
}

test('a cache miss publishes the entry and leaves no tmp file', () => {
  const dir = cacheDir();
  const file = join(dir, 'entry.js');
  publishCacheFile(nodeFs, file, `${file}.1.0.tmp`, 'export {};');
  expect(readFileSync(file, 'utf8')).toBe('export {};');
  expect(readdirSync(dir)).toEqual(['entry.js']);
});

for (const code of ['EPERM', 'EACCES', 'EBUSY'])
  test(`a cache miss outlasts an entry another worker holds (${code})`, () => {
    // regression: bun-test-solid-cache-windows-busy-rename
    const dir = cacheDir();
    const file = join(dir, 'entry.js');
    nodeFs.writeFileSync(file, 'export {};');
    expect(() =>
      publishCacheFile(
        refusingRename(code),
        file,
        `${file}.2.1.tmp`,
        'export {};'
      )
    ).not.toThrow();
    expect(readFileSync(file, 'utf8')).toBe('export {};');
    expect(readdirSync(dir)).toEqual(['entry.js']);
  });

test('any other rename failure still fails the miss, without a stray tmp file', () => {
  const dir = cacheDir();
  const file = join(dir, 'entry.js');
  expect(() =>
    publishCacheFile(
      refusingRename('ENOSPC'),
      file,
      `${file}.3.0.tmp`,
      'export {};'
    )
  ).toThrow('ENOSPC');
  expect(readdirSync(dir)).toEqual([]);
});
