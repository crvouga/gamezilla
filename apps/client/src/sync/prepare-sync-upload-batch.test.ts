import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { prepareSyncUploadBatch as PrepareSyncUploadBatch } from './sync-api';

describe('prepareSyncUploadBatch', () => {
  let prepareSyncUploadBatch: PrepareSyncUploadBatch;

  beforeAll(async () => {
    await mock.module('@libs/auth/client/use-current-account-id', () => ({
      getCachedCurrentAccountId: () => 'account-1',
    }));
    await mock.module('@libs/auth/client/use-device-id', () => ({
      getCachedDeviceId: () => 'device-1',
    }));
    await mock.module('@libs/auth/client/use-fresh-auth-token', () => ({
      getCachedAuthToken: () => 'token',
    }));
    ({ prepareSyncUploadBatch } = await import('./sync-api'));
  });

  test('drops username-only profile patches so they are not uploaded', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'patch',
          table: PROFILES_TABLE.tableName,
          id: 'account-1',
          values: { [ProfileCol.username]: 'Assigned' },
        },
      ],
    });
    expect(prepared.rows).toEqual([]);
  });

  test('keeps avatar patches after stripping username', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'patch',
          table: PROFILES_TABLE.tableName,
          id: 'account-1',
          values: {
            [ProfileCol.username]: 'Assigned',
            [ProfileCol.avatarConfig]: '{"style":"bottts"}',
          },
        },
      ],
    });
    expect(prepared.rows).toEqual([
      {
        op: 'patch',
        table: PROFILES_TABLE.tableName,
        id: 'account-1',
        values: { [ProfileCol.avatarConfig]: '{"style":"bottts"}' },
      },
    ]);
  });

  test('drops profile rows that are not the signed-in account', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'put',
          table: PROFILES_TABLE.tableName,
          id: 'other-user',
          values: {
            id: 'other-user',
            [ProfileCol.avatarConfig]: '{"style":"bottts"}',
          },
        },
        {
          op: 'put',
          table: 'spaces',
          id: 'space-1',
          values: { id: 'space-1', name: 'Lobby' },
        },
      ],
    });
    expect(prepared.rows).toEqual([
      {
        op: 'put',
        table: 'spaces',
        id: 'space-1',
        values: { id: 'space-1', name: 'Lobby' },
      },
    ]);
  });
});
