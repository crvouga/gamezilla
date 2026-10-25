import { expect, test } from 'bun:test';
import {
  HARNESS_SYSTEM_SNAPSHOT_VERSION,
  type HarnessSystemSnapshot,
} from '@pkgs/harness-console-shared-ts/system-snapshot';
import { parseHarnessSystemSnapshotJson } from '@pkgs/harness-console-shared-ts/system-snapshot-schema';

test('portable snapshots retain live recovery bytes alongside events and retry outcomes', () => {
  // regression: simulation-restart-loses-published-progress
  const snapshot: HarnessSystemSnapshot = {
    version: HARNESS_SYSTEM_SNAPSHOT_VERSION,
    localSchemaVersion: 1,
    clockMs: 100,
    clockPaused: false,
    clientIds: [],
    roomTopics: ['space:race'],
    partitions: [],
    skewByAddress: {},
    downAddresses: [],
    evictedAddresses: [],
    server: { version: 1, tables: {} },
    clients: {},
    rooms: {
      'space:race': {
        entries: [],
        dedup: {},
        liveCheckpoint: {
          atSeq: 0,
          payload: { type: 'race/checkpoint', payload: { tick: 6 } },
        },
      },
    },
  };
  expect(parseHarnessSystemSnapshotJson(JSON.stringify(snapshot))).toEqual(
    snapshot
  );
  const missing = {
    ...snapshot,
    rooms: { 'space:race': { entries: [], dedup: {} } },
  };
  expect(() => parseHarnessSystemSnapshotJson(JSON.stringify(missing))).toThrow(
    'liveCheckpoint'
  );
});
