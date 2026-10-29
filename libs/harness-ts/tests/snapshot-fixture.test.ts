import { expect, test } from 'bun:test';
import { basename } from 'node:path';
import {
  harnessSnapshotFixtureText,
  parseHarnessSnapshotFixture,
  resolveHarnessSnapshotPath,
} from '@libs/harness-ts/snapshot-fixture';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { technicalKey } from '@libs/product-identity-shared-ts/technical-names';
import {
  HARNESS_SYSTEM_SNAPSHOT_VERSION,
  type HarnessSystemSnapshot,
} from '@pkgs/harness-console-shared-ts/system-snapshot';
import { SQL_DATA_DUMP_VERSION } from '@pkgs/sql-client-root-shared-ts/types';

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

test('a fixture stores technical keys under {namespace} and restores them', () => {
  const bearer = technicalKey('auth.bearer');
  const empty = { version: SQL_DATA_DUMP_VERSION, tables: {} };
  const snapshot: HarnessSystemSnapshot = {
    version: HARNESS_SYSTEM_SNAPSHOT_VERSION,
    localSchemaVersion: 1,
    clockMs: 0,
    clockPaused: true,
    clientIds: ['alice'],
    roomTopics: [],
    partitions: [],
    skewByAddress: {},
    downAddresses: [],
    evictedAddresses: [],
    server: empty,
    clients: {
      alice: { tables: empty, kv: { [bearer]: 'token', deviceId: 'device' } },
    },
    rooms: {},
  };
  const text = harnessSnapshotFixtureText(snapshot);
  expect(text).toContain('"{namespace}.auth.bearer"');
  expect(text).not.toContain(NAMESPACE);
  expect(parseHarnessSnapshotFixture(text)).toEqual(snapshot);
});
