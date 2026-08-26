import { describe, expect, test } from 'bun:test';

import { resolveConnectivityStatus } from './resolve-connectivity-status';

describe('resolveConnectivityStatus', () => {
  test('browser offline is offline', () => {
    expect(
      resolveConnectivityStatus({
        browserOnline: false,
        syncOnline: true,
        syncError: false,
        connection: 'connected',
        hasSynced: true,
      })
    ).toBe('offline');
  });

  test('sync error is warning', () => {
    expect(
      resolveConnectivityStatus({
        browserOnline: true,
        syncOnline: true,
        syncError: true,
        connection: 'syncing',
        hasSynced: false,
      })
    ).toBe('warning');
  });

  test('connecting before first sync is pending', () => {
    expect(
      resolveConnectivityStatus({
        browserOnline: true,
        syncOnline: true,
        syncError: false,
        connection: 'connecting',
        hasSynced: false,
      })
    ).toBe('pending');
  });

  test('syncing before first sync is pending', () => {
    expect(
      resolveConnectivityStatus({
        browserOnline: true,
        syncOnline: true,
        syncError: false,
        connection: 'syncing',
        hasSynced: false,
      })
    ).toBe('pending');
  });

  test('connected after sync is online', () => {
    expect(
      resolveConnectivityStatus({
        browserOnline: true,
        syncOnline: true,
        syncError: false,
        connection: 'connected',
        hasSynced: true,
      })
    ).toBe('online');
  });

  test('disconnected is offline', () => {
    expect(
      resolveConnectivityStatus({
        browserOnline: true,
        syncOnline: true,
        syncError: false,
        connection: 'disconnected',
        hasSynced: false,
      })
    ).toBe('offline');
  });
});
