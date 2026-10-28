import { expect, test } from 'bun:test';
import { basename } from 'node:path';
import { resolveHarnessSnapshotPath } from '@libs/harness-ts/snapshot-fixture';

test('a snapshot id names one flat fixture file', () => {
  expect(basename(resolveHarnessSnapshotPath('two-friends'))).toBe(
    'two-friends.json'
  );
});

// regression: snapshot-id-windows-separator
test('a snapshot id cannot reach into a directory with either separator', () => {
  for (const id of ['nested/name', 'nested\\name', '..', ''])
    expect(() => resolveHarnessSnapshotPath(id)).toThrow('invalid snapshot id');
});
