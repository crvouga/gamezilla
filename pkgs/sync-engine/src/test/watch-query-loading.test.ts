import { describe, expect, test } from 'bun:test';

import type { SyncEngineStatus } from '../client/sync-status';
import { computeWatchQueryIsLoading } from '../client/watch-query-loading';

const connectedSynced: SyncEngineStatus = {
  connection: 'connected',
  online: true,
  hasSynced: true,
  hasEverSynced: true,
  lastError: null,
};

const reconnecting: SyncEngineStatus = {
  connection: 'connecting',
  online: false,
  hasSynced: false,
  hasEverSynced: true,
  lastError: null,
};

describe('computeWatchQueryIsLoading', () => {
  test('loading until hydrated', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: false,
        rows: [],
        status: connectedSynced,
        reconnecting: false,
      })
    ).toBe(true);
  });

  test('not loading when rows present', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [{ id: 'a' }],
        status: connectedSynced,
        reconnecting: false,
      })
    ).toBe(false);
  });

  test('not loading when hydrated empty and synced', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [],
        status: connectedSynced,
        reconnecting: false,
      })
    ).toBe(false);
  });

  test('loading when empty and reconnecting', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [],
        status: reconnecting,
        reconnecting: true,
      })
    ).toBe(true);
  });
});
