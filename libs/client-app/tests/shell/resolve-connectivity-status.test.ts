import { describe, expect, test } from 'bun:test';
import { resolveConnectivityStatus } from '@libs/client-app/chrome/resolve-connectivity-status';

const base = {
  browserOnline: true,
  syncOnline: true,
  syncError: false,
  connection: 'connected',
  hasSynced: true,
} as const;

describe('resolveConnectivityStatus', () => {
  test('device offline wins', () => {
    expect(
      resolveConnectivityStatus({
        ...base,
        browserOnline: false,
        syncError: true,
      })
    ).toBe('offline');
  });

  test('sync error → warning', () => {
    expect(resolveConnectivityStatus({ ...base, syncError: true })).toBe(
      'warning'
    );
  });

  test('disconnected or sync offline → offline', () => {
    expect(
      resolveConnectivityStatus({ ...base, connection: 'disconnected' })
    ).toBe('offline');
    expect(resolveConnectivityStatus({ ...base, syncOnline: false })).toBe(
      'offline'
    );
  });

  test('connected + synced → online, otherwise pending', () => {
    expect(resolveConnectivityStatus(base)).toBe('online');
    expect(resolveConnectivityStatus({ ...base, hasSynced: false })).toBe(
      'pending'
    );
    expect(resolveConnectivityStatus({ ...base, connection: 'syncing' })).toBe(
      'pending'
    );
  });
});
