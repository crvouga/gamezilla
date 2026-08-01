import { describe, expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  ApplyBatchReject,
  applyBatch,
  createTablePolicyRegistry,
  denyTablePolicy,
  type TablePolicy,
} from '../server/apply-batch';
import { createUploadBatch, type UploadOp } from '../shared/upload-batch';
import type { UploadAuth } from '../shared/rules-auth';

const auth: UploadAuth = {
  userId: 'user-1',
  deviceId: 'device-1',
  accountId: 'user-1',
  memberOfSpaceIds: [],
};

function mockSqlClient(): SqlClient {
  return {
    connect: async () => {},
    disconnect: async () => {},
    query: async () => [],
    run: async () => ({ changes: 1, lastInsertRowid: 0 }),
    transaction: async (fn) => fn(mockSqlClient()),
    prepare: () => ({
      query: async () => [],
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    }),
  };
}

function widgetsPolicy(
  authorize: TablePolicy['authorize']
): TablePolicy {
  return {
    table: 'widgets',
    allowedOps: new Set<UploadOp>(['put', 'patch', 'delete']),
    allowedColumns: new Set(['name', 'owner_id']),
    authorize,
  };
}

describe('applyBatch', () => {
  test('throws ApplyBatchReject when table has no policy', async () => {
    const db = mockSqlClient();
    const batch = createUploadBatch([
      { op: 'patch', table: 'missing', id: '1', values: { name: 'x' } },
    ]);

    await expect(
      applyBatch(db, auth, batch, createTablePolicyRegistry([]))
    ).rejects.toMatchObject({
      failures: [{ code: 'NO_WRITE_FOR_TABLE', table: 'missing', id: '1' }],
    });
  });

  test('throws ApplyBatchReject when ownership check fails', async () => {
    const db = mockSqlClient();
    const batch = createUploadBatch([
      { op: 'patch', table: 'widgets', id: '1', values: { name: 'x' } },
    ]);
    const policies = createTablePolicyRegistry([
      widgetsPolicy(async () => ({ ok: false, code: 'NOT_OWNER' })),
    ]);

    try {
      await applyBatch(db, auth, batch, policies);
      expect.unreachable('expected ApplyBatchReject');
    } catch (e) {
      expect(e).toBeInstanceOf(ApplyBatchReject);
      expect((e as ApplyBatchReject).failures).toEqual([
        { code: 'NOT_OWNER', table: 'widgets', id: '1' },
      ]);
    }
  });

  test('accepts empty patch as no-op without running SQL', async () => {
    let ran = false;
    const db: SqlClient = {
      ...mockSqlClient(),
      run: async () => {
        ran = true;
        return { changes: 1, lastInsertRowid: 0 };
      },
    };
    const batch = createUploadBatch([
      { op: 'patch', table: 'widgets', id: '1', values: { unknown_col: 'x' } },
    ]);
    const policies = createTablePolicyRegistry([
      widgetsPolicy(async () => ({ ok: true })),
    ]);

    await applyBatch(db, auth, batch, policies);
    expect(ran).toBe(false);
  });

  test('denyTablePolicy rejects all writes with the given code', async () => {
    const db = mockSqlClient();
    const batch = createUploadBatch([
      { op: 'delete', table: 'server_owned', id: '1' },
    ]);
    const policies = createTablePolicyRegistry([
      denyTablePolicy('server_owned', 'SERVER_OWNED_TABLE'),
    ]);

    await expect(
      applyBatch(db, auth, batch, policies)
    ).rejects.toMatchObject({
      failures: [
        { code: 'SERVER_OWNED_TABLE', table: 'server_owned', id: '1' },
      ],
    });
  });
});
