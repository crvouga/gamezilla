import { describe, expect, test } from 'bun:test';
import {
  createRowWriteBinding,
  createRowWriteRegistry,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import { ok } from '@pkgs/write/shared/write-result';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { RowChange } from '@pkgs/write/shared/row-change';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { createWriteAuthorizedUploadHandler } from '../server/create-write-authorized-upload-handler';
import { parseUploadBody, processUploadBatch } from '../server/upload-handler';

const ctx: WriteContext = {
  subjectId: 'user-1',
  deviceId: 'device-1',
  accountId: 'user-1',
  myId: 'user-1',
  isAnonymous: false,
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

describe('createWriteAuthorizedUploadHandler', () => {
  test('rejects rows failing row authorization', async () => {
    const binding = createRowWriteBinding(
      defineRowAuthorizeWrite({
        name: 'widgets.patch',
        authorize: async () => ok(undefined),
      })
    ) as RowWriteBinding<RowChange>;

    const registry = createRowWriteRegistry({
      widgets: binding,
    });

    const batch = parseUploadBody({
      rows: [{ op: 'patch', table: 'missing', id: '1', values: { a: 'b' } }],
    });

    const handler = createWriteAuthorizedUploadHandler({
      resolveAuth: async () => ({ writeContext: ctx }),
      mapAuth: (auth) => auth.writeContext,
      rowRegistry: registry,
      openSql: async () => mockSqlClient(),
    });

    const response = await handler({
      req: {
        raw: new Request('http://localhost/sync/upload', {
          method: 'POST',
          body: JSON.stringify(batch),
        }),
        json: async () => batch,
      },
      json: (body: unknown, status?: number) =>
        new Response(JSON.stringify(body), { status: status ?? 200 }),
    } as never);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: Array<{ status: string; reason?: string }>;
    };
    expect(body.results[0]).toEqual({
      status: 'rejected',
      reason: 'NO_WRITE_FOR_TABLE',
    });
  });
});

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
