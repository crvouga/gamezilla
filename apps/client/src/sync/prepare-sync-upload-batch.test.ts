import { describe, expect, test } from 'bun:test';
import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';

import { prepareSyncUploadBatch } from './sync-api';

const AUTH = { accountId: 'account-1' as string | null };

describe('prepareSyncUploadBatch', () => {
  test('keeps profile username patches (server mutators discard DOMAIN residue)', () => {
    const prepared = prepareSyncUploadBatch(
      {
        rows: [
          {
            op: 'patch',
            table: PROFILES_TABLE.tableName,
            id: 'account-1',
            values: { username: 'Assigned' },
          },
        ],
      },
      AUTH
    );
    expect(prepared.rows).toEqual([
      {
        op: 'patch',
        table: PROFILES_TABLE.tableName,
        id: 'account-1',
        values: { username: 'Assigned' },
      },
    ]);
  });

  test('keeps avatar and username together on profile patches', () => {
    const prepared = prepareSyncUploadBatch(
      {
        rows: [
          {
            op: 'patch',
            table: PROFILES_TABLE.tableName,
            id: 'account-1',
            values: {
              username: 'Assigned',
              avatar_config: '{"style":"bottts"}',
            },
          },
        ],
      },
      AUTH
    );
    expect(prepared.rows).toEqual([
      {
        op: 'patch',
        table: PROFILES_TABLE.tableName,
        id: 'account-1',
        values: {
          username: 'Assigned',
          avatar_config: '{"style":"bottts"}',
        },
      },
    ]);
  });

  test('drops profile rows that are not the signed-in account', () => {
    const prepared = prepareSyncUploadBatch(
      {
        rows: [
          {
            op: 'put',
            table: PROFILES_TABLE.tableName,
            id: 'other-user',
            values: {
              id: 'other-user',
              avatar_config: '{"style":"bottts"}',
            },
          },
          {
            op: 'put',
            table: 'spaces',
            id: 'space-1',
            values: { id: 'space-1', host_member_id: 'account-1' },
          },
        ],
      },
      AUTH
    );
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
    const prepared = prepareSyncUploadBatch(
      {
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
      },
      AUTH
    );
    expect(prepared.rows.map((row) => row.table)).toEqual([
      'spaces',
      'space_users',
    ]);
  });

  test('drops removed tables like space_memberships', () => {
    const prepared = prepareSyncUploadBatch(
      {
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
      },
      AUTH
    );
    expect(prepared.rows.map((row) => row.table)).toEqual(['spaces']);
  });

  test('strips dropped space columns like active_member_count', () => {
    const prepared = prepareSyncUploadBatch(
      {
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
      },
      AUTH
    );
    expect(prepared.rows).toEqual([
      {
        op: 'put',
        table: 'spaces',
        id: 'space-1',
        values: { id: 'space-1', host_member_id: 'account-1' },
      },
    ]);
  });

  test('strips SERVER_ONLY rows like write_rejections', () => {
    const prepared = prepareSyncUploadBatch(
      {
        rows: [
          {
            op: 'patch',
            table: 'write_rejections',
            id: 'rej-1',
            values: { acknowledged: 1 },
          },
          {
            op: 'put',
            table: '_mutations',
            id: 'mut-1',
            values: {
              id: 'mut-1',
              name: 'acknowledgeWriteRejection',
              args: '{}',
              client_id: 'device-1',
              seq: 1,
              created_at: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
      },
      AUTH
    );
    expect(prepared.rows.map((row) => row.table)).toEqual(['_mutations']);
  });
});
