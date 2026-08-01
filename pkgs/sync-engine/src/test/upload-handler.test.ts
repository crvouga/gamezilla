import { describe, expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { parseUploadBody, processUploadBatch } from '../server/upload-handler';

const ctx = {
  userId: 'user-1',
  deviceId: 'device-1',
  accountId: 'user-1',
  memberOfSpaceIds: [] as const,
};

describe('processUploadBatch', () => {
  test('applies accepted rows', async () => {
    let ran = false;
    const sql: SqlClient = {
      connect: async () => {},
      disconnect: async () => {},
      query: async () => [],
      run: async () => {
        ran = true;
        return { changes: 1, lastInsertRowid: 0 };
      },
      transaction: async (fn) => fn(sql),
      prepare: () => ({
        query: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      }),
    };

    const batch = parseUploadBody({
      rows: [{ op: 'patch', table: 'widgets', id: '1', values: { a: 'b' } }],
    });

    const out = await processUploadBatch(
      sql,
      ctx,
      async () => ({ status: 'accepted' as const }),
      batch
    );

    expect(out.results[0]).toEqual({ status: 'accepted' });
    expect(ran).toBe(true);
  });

  test('rejects rows with a SQL-injecting column name', async () => {
    let ran = false;
    const sql: SqlClient = {
      connect: async () => {},
      disconnect: async () => {},
      query: async () => [],
      run: async () => {
        ran = true;
        return { changes: 1, lastInsertRowid: 0 };
      },
      transaction: async (fn) => fn(sql),
      prepare: () => ({
        query: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      }),
    };

    const batch = parseUploadBody({
      rows: [
        {
          op: 'patch',
          table: 'widgets',
          id: '1',
          values: { 'x = 1; DROP TABLE widgets; --': 'boom' },
        },
      ],
    });

    const out = await processUploadBatch(
      sql,
      ctx,
      async () => ({ status: 'accepted' as const }),
      batch
    );

    expect(out.results[0]?.status).toBe('rejected');
    expect(ran).toBe(false);
  });

  test('accepts empty patch as a no-op without running SQL', async () => {
    let ran = false;
    const sql: SqlClient = {
      connect: async () => {},
      disconnect: async () => {},
      query: async () => [],
      run: async () => {
        ran = true;
        return { changes: 1, lastInsertRowid: 0 };
      },
      transaction: async (fn) => fn(sql),
      prepare: () => ({
        query: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      }),
    };

    const batch = parseUploadBody({
      rows: [{ op: 'patch', table: 'profiles', id: '1', values: {} }],
    });

    const out = await processUploadBatch(
      sql,
      ctx,
      async () => ({ status: 'accepted' as const }),
      batch
    );

    expect(out.results[0]).toEqual({ status: 'accepted' });
    expect(ran).toBe(false);
  });

  test('rejects rows with a SQL-injecting table name', async () => {
    let ran = false;
    const sql: SqlClient = {
      connect: async () => {},
      disconnect: async () => {},
      query: async () => [],
      run: async () => {
        ran = true;
        return { changes: 1, lastInsertRowid: 0 };
      },
      transaction: async (fn) => fn(sql),
      prepare: () => ({
        query: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      }),
    };

    const batch = parseUploadBody({
      rows: [
        { op: 'delete', table: 'widgets; DROP TABLE widgets; --', id: '1' },
      ],
    });

    const out = await processUploadBatch(
      sql,
      ctx,
      async () => ({ status: 'accepted' as const }),
      batch
    );

    expect(out.results[0]?.status).toBe('rejected');
    expect(ran).toBe(false);
  });
});
