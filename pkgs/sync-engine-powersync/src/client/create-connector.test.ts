import { describe, expect, test } from 'bun:test';

import { createPowerSyncConnector, mapCrudOp } from './create-connector';
import type { PowerSyncCrudTransaction } from './powersync-database-port';

describe('mapCrudOp', () => {
  test('maps PATCH with missing opData to empty values', () => {
    expect(mapCrudOp({ op: 'PATCH', table: 'profiles', id: 'p1' })).toEqual({
      op: 'patch',
      table: 'profiles',
      id: 'p1',
      values: {},
    });
  });
});

describe('createPowerSyncConnector uploadData', () => {
  test('skips upload and completes when all CRUD ops are empty patches', async () => {
    let uploaded = false;
    let completed = false;
    const transaction: PowerSyncCrudTransaction = {
      crud: [{ op: 'PATCH', table: 'profiles', id: 'p1', opData: {} }],
      complete: async () => {
        completed = true;
      },
    };
    const connector = createPowerSyncConnector({
      powersyncUrl: 'https://ps.example',
      fetchSyncToken: async () => ({ token: 't', expiresAt: 1 }),
      uploadBatch: async () => {
        uploaded = true;
      },
    });
    await connector.uploadData({
      getNextCrudTransaction: async () => transaction,
    });
    expect(uploaded).toBe(false);
    expect(completed).toBe(true);
  });
});
