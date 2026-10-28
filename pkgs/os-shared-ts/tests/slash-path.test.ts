import { expect, test } from 'bun:test';
import { posix, win32 } from 'node:path';
import { lastSegment, slashPath } from '@pkgs/os-shared-ts/slash-path';

test('a relative path reads the same on every OS', () => {
  expect(slashPath(win32.relative('C:\\repo', 'C:\\repo\\libs\\a\\b.ts'))).toBe(
    'libs/a/b.ts'
  );
  expect(slashPath(posix.relative('/repo', '/repo/libs/a/b.ts'))).toBe(
    'libs/a/b.ts'
  );
});

test('the last segment ignores which separator a path uses', () => {
  expect(lastSegment('C:\\repo\\specs\\a-b.qnt')).toBe('a-b.qnt');
  expect(lastSegment('/repo/specs/a-b.qnt')).toBe('a-b.qnt');
  expect(lastSegment('a-b.qnt')).toBe('a-b.qnt');
});
