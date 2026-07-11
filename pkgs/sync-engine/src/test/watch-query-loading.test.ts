import { describe, expect, test } from 'bun:test';

import { computeWatchQueryIsLoading } from '../client/watch-query-loading';
import type { SyncEngineStatus } from '../client/sync-status';

const baseStatus: SyncEngineStatus = {
  connection: 'connected',
  online: true,
  hasSynced: true,
  hasEverSynced: true,
  lastError: null,
};

describe('computeWatchQueryIsLoading', () => {
  test('returns false before hydration when display rows exist', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: false,
        displayRows: [{ id: 's1' }],
        hadRows: false,
        confirmedEmpty: false,
        status: baseStatus,
        reconnecting: false,
      })
    ).toBe(false);
  });

  test('returns false before hydration when hadRows is true', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: false,
        displayRows: [],
        hadRows: true,
        confirmedEmpty: false,
        status: baseStatus,
        reconnecting: false,
      })
    ).toBe(false);
  });

  test('returns true before hydration with no rows or cache signals', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: false,
        displayRows: [],
        hadRows: false,
        confirmedEmpty: false,
        status: baseStatus,
        reconnecting: false,
      })
    ).toBe(true);
  });

  test('returns false when confirmed empty after hydration', () => {
    expect(
      computeWatchQueryIsLoading({
        hydrated: true,
        displayRows: [],
        hadRows: false,
        confirmedEmpty: true,
        status: baseStatus,
        reconnecting: false,
      })
    ).toBe(false);
  });
});
