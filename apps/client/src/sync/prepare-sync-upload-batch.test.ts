import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';

describe('prepareSyncUploadBatch', () => {
  let prepareSyncUploadBatch: (batch: UploadBatch) => UploadBatch;

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
          values: { id: 'space-1', host_member_id: 'account-1' },
        },
      ],
    });
    expect(prepared.rows).toEqual([
      {
        op: 'put',
        table: 'spaces',
        id: 'space-1',
        values: { id: 'space-1', host_member_id: 'account-1' },
      },
    ]);
  });

  test('orders spaces before space_users for FK-safe create uploads', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'put',
          table: 'space_users',
          id: 'space-1:account-1',
          values: {
            id: 'space-1:account-1',
            space_id: 'space-1',
            user_id: 'account-1',
          },
        },
        {
          op: 'put',
          table: 'spaces',
          id: 'space-1',
          values: { id: 'space-1', host_member_id: 'account-1' },
        },
      ],
    });
    expect(prepared.rows.map((row) => row.table)).toEqual([
      'spaces',
      'space_users',
    ]);
  });

  test('drops removed tables like space_memberships', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'put',
          table: 'space_memberships',
          id: 'account-1:space-1',
          values: {
            id: 'account-1:space-1',
            space_id: 'space-1',
            member_id: 'account-1',
          },
        },
        {
          op: 'put',
          table: 'spaces',
          id: 'space-1',
          values: { id: 'space-1', host_member_id: 'account-1' },
        },
      ],
    });
    expect(prepared.rows.map((row) => row.table)).toEqual(['spaces']);
  });

  test('strips dropped space columns like active_member_count', () => {
    const prepared = prepareSyncUploadBatch({
      rows: [
        {
          op: 'put',
          table: 'spaces',
          id: 'space-1',
          values: {
            id: 'space-1',
            host_member_id: 'account-1',
            active_member_count: 1,
          },
        },
      ],
    });
    expect(prepared.rows).toEqual([
      {
        op: 'put',
        table: 'spaces',
        id: 'space-1',
        values: { id: 'space-1', host_member_id: 'account-1' },
      },
    ]);
  });
});
