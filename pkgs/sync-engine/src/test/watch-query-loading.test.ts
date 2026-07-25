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

const reconnectingEverSynced: SyncEngineStatus = {
  connection: 'connecting',
  online: false,
  hasSynced: false,
  hasEverSynced: true,
  lastError: null,
};

const neverSynced: SyncEngineStatus = {
  connection: 'syncing',
  online: true,
  hasSynced: false,
  hasEverSynced: false,
  lastError: null,
};

describe('computeWatchQueryIsLoading', () => {
  test('loading until hydrated', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: false,
        rows: [],
        status: connectedSynced,
      })
    ).toBe(true);
  });

  test('not loading when rows present', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [{ id: 'a' }],
        status: connectedSynced,
      })
    ).toBe(false);
  });

  test('not loading when hydrated empty and ever synced', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [],
        status: connectedSynced,
      })
    ).toBe(false);
  });

  test('not loading when empty after ever synced even while reconnecting', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [],
        status: reconnectingEverSynced,
      })
    ).toBe(false);
  });

  test('loading when empty and never synced', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [],
        status: neverSynced,
      })
    ).toBe(true);
  });

  test('not loading when rows present even if never synced', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        rows: [{ id: 'a' }],
        status: neverSynced,
      })
    ).toBe(false);
  });
});
