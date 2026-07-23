import { describe, expect, test } from 'bun:test';

import type { SyncEngineStatus } from '../client/sync-status';
import {
  resolveWatchQueryDisplayRows,
  shouldConfirmWatchQueryEmpty,
} from '../client/watch-query-display';

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

describe('resolveWatchQueryDisplayRows', () => {
  test('returns live rows when present', () => {
    const live = [{ id: 'a' }];
    expect(
      resolveWatchQueryDisplayRows({
        rows: live,
        cachedRows: [{ id: 'stale' }],
        reconnecting: false,
        prevRows: [{ id: 'prev' }],
        hydrated: true,
      })
    ).toEqual(live);
  });

  test('drops stale cache after hydrated empty while connected', () => {
    expect(
      resolveWatchQueryDisplayRows({
        rows: [],
        cachedRows: [{ id: 'ended' }],
        reconnecting: false,
        prevRows: [{ id: 'ended' }],
        hydrated: true,
      })
    ).toEqual([]);
  });

  test('holds cache before hydrate', () => {
    const cached = [{ id: 'cached' }];
    expect(
      resolveWatchQueryDisplayRows({
        rows: [],
        cachedRows: cached,
        reconnecting: false,
        prevRows: [],
        hydrated: false,
      })
    ).toEqual(cached);
  });

  test('holds cache while reconnecting', () => {
    const cached = [{ id: 'cached' }];
    expect(
      resolveWatchQueryDisplayRows({
        rows: [],
        cachedRows: cached,
        reconnecting: true,
        prevRows: [],
        hydrated: true,
      })
    ).toEqual(cached);
  });
});

describe('shouldConfirmWatchQueryEmpty', () => {
  test('confirms empty when hydrated and connected', () => {
    expect(
      shouldConfirmWatchQueryEmpty({
        reconnecting: false,
        status: connectedSynced,
        hydrated: true,
      })
    ).toBe(true);
  });

  test('does not confirm empty while reconnecting', () => {
    expect(
      shouldConfirmWatchQueryEmpty({
        reconnecting: true,
        status: reconnecting,
        hydrated: true,
      })
    ).toBe(false);
  });
});
