import { describe, expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  ApplyBatchReject,
  createTablePolicyRegistry,
  type TablePolicy,
} from '../server/apply-batch';
import { processUploadWithRules } from '../server/process-upload-with-rules';
import type { UploadAuth } from '../shared/rules-auth';
import { createUploadBatch, type UploadOp } from '../shared/upload-batch';

const auth: UploadAuth = {
  userId: 'user-1',
  deviceId: 'device-1',
  accountId: 'user-1',
  memberOfSpaceIds: [],
};

function mockSqlClient(applied: string[]): SqlClient {
  const self: SqlClient = {
    connect: async () => {},
    disconnect: async () => {},
    query: async () => [],
    run: async (q) => {
      applied.push(q.sql);
      return { changes: 1, lastInsertRowid: 0 };
    },
    transaction: async (fn) => fn(self),
    prepare: () => ({
      query: async () => [],
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    }),
  };
  return self;
}

function widgetsPolicy(
  authorize: TablePolicy['authorize']
): TablePolicy {
  return {
    table: 'widgets',
    allowedOps: new Set<UploadOp>(['put', 'patch', 'delete']),
    allowedColumns: new Set(['name', 'id']),
    authorize,
  };
}

describe('processUploadWithRules', () => {
  test('accepts when before, apply, and after succeed', async () => {
    const applied: string[] = [];
    const phases: string[] = [];
    const db = mockSqlClient(applied);
    const batch = createUploadBatch([
      { op: 'put', table: 'widgets', id: '1', values: { id: '1', name: 'a' } },
    ]);
    const result = await processUploadWithRules({
      db,
      auth,
      batch,
      policies: createTablePolicyRegistry([
        widgetsPolicy(async () => ({ ok: true })),
      ]),
      lockUserId: auth.userId,
      runRules: async ({ phase }) => {
        phases.push(phase);
      },
    });
    expect(result).toBe('accepted');
    expect(phases).toEqual(['before', 'after']);
    expect(applied.some((s) => s.includes('INSERT') || s.includes('widgets'))).toBe(
      true
    );
  });

  test('before failure skips apply', async () => {
    const applied: string[] = [];
    const db = mockSqlClient(applied);
    const batch = createUploadBatch([
      { op: 'put', table: 'widgets', id: '1', values: { id: '1', name: 'a' } },
    ]);
    await expect(
      processUploadWithRules({
        db,
        auth,
        batch,
        policies: createTablePolicyRegistry([
          widgetsPolicy(async () => ({ ok: true })),
        ]),
        lockUserId: auth.userId,
        runRules: async ({ phase }) => {
          if (phase === 'before') {
            throw new Error('BEFORE_FAIL');
          }
        },
      })
    ).rejects.toThrow('BEFORE_FAIL');
    expect(applied.filter((s) => s.includes('INSERT')).length).toBe(0);
  });

  test('applyBatch reject surfaces ApplyBatchReject', async () => {
    const db = mockSqlClient([]);
    const batch = createUploadBatch([
      { op: 'put', table: 'widgets', id: '1', values: { id: '1', name: 'a' } },
    ]);
    await expect(
      processUploadWithRules({
        db,
        auth,
        batch,
        policies: createTablePolicyRegistry([
          widgetsPolicy(async () => ({ ok: false, code: 'NOT_OWNER' })),
        ]),
        lockUserId: auth.userId,
        runRules: async () => {},
      })
    ).rejects.toBeInstanceOf(ApplyBatchReject);
  });

  test('after failure rejects after apply attempted', async () => {
    const phases: string[] = [];
    const db = mockSqlClient([]);
    const batch = createUploadBatch([
      { op: 'put', table: 'widgets', id: '1', values: { id: '1', name: 'a' } },
    ]);
    await expect(
      processUploadWithRules({
        db,
        auth,
        batch,
        policies: createTablePolicyRegistry([
          widgetsPolicy(async () => ({ ok: true })),
        ]),
        lockUserId: auth.userId,
        runRules: async ({ phase }) => {
          phases.push(phase);
          if (phase === 'after') {
            throw new Error('AFTER_FAIL');
          }
        },
      })
    ).rejects.toThrow('AFTER_FAIL');
    expect(phases).toEqual(['before', 'after']);
  });
});
