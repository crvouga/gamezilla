import { describe, expect, test } from 'bun:test';
import { applyKvStorageOptimizations } from '@pkgs/kv-postgres-shared-ts/postgres-storage-knobs';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

function clientWithRun(run: SqlClient['run'], relpersistence = 'u'): SqlClient {
  return {
    run,
    query: async () => [{ relpersistence }],
  } as unknown as SqlClient;
}

const log = createLogger({
  name: 'postgres-storage-knobs-test',
  level: 'silent',
  now: () => 0,
});

describe('applyKvStorageOptimizations', () => {
  // regression: neki-kv-storage-ddl-unsupported
  test('continues when the database explicitly rejects optional storage DDL', async () => {
    const statements: string[] = [];
    let transactionAborted = false;
    const client = clientWithRun(async (query) => {
      statements.push(query.sql);
      if (query.sql.includes('ROLLBACK TO SAVEPOINT')) {
        transactionAborted = false;
        return { changes: 0, lastInsertRowid: 0 };
      }
      if (transactionAborted) {
        throw Object.assign(new Error('current transaction is aborted'), {
          code: '25P02',
        });
      }
      if (query.sql.includes('SET STORAGE')) {
        transactionAborted = true;
        throw Object.assign(
          new Error(
            'not implemented: [334] ALTER COLUMN SET STORAGE is not supported'
          ),
          { code: 'NK013' }
        );
      }
      return { changes: 0, lastInsertRowid: 0 };
    });

    await expect(
      applyKvStorageOptimizations(client, log, { alreadyInTransaction: true })
    ).resolves.toBe(undefined);
    expect(statements.some((sql) => sql.includes('SET STORAGE MAIN'))).toBe(
      true
    );
    expect(
      statements.some((sql) => sql.includes('ROLLBACK TO SAVEPOINT'))
    ).toBe(true);
  });

  // regression: mockingbird-postgres-storage-sqlstate
  test('continues when Mockingbird reports unsupported storage DDL as XX000', async () => {
    const statements: string[] = [];
    const client = clientWithRun(async (query) => {
      statements.push(query.sql);
      if (query.sql.includes('SET STORAGE')) {
        throw Object.assign(
          new Error('this ALTER COLUMN SET form is not supported'),
          { code: 'XX000' }
        );
      }
      return { changes: 0, lastInsertRowid: 0 };
    }, 'p');

    await expect(applyKvStorageOptimizations(client, log)).resolves.toBe(
      undefined
    );
    expect(statements.some((sql) => sql.includes('SET STORAGE MAIN'))).toBe(
      true
    );
    expect(statements.some((sql) => sql.includes('SET UNLOGGED'))).toBe(true);
  });

  test('does not treat an unrelated XX000 as optional storage DDL', async () => {
    const failure = Object.assign(
      new Error('operator does not exist: oid = regnamespace'),
      { code: 'XX000' }
    );
    const client = clientWithRun(async () => {
      throw failure;
    });

    await expect(applyKvStorageOptimizations(client, log)).rejects.toBe(
      failure
    );
  });

  // regression: neki-kv-storage-ddl-unsupported
  test('defers optional storage DDL while a reconciled table becomes visible', async () => {
    const failure = Object.assign(new Error('relation "kv" does not exist'), {
      code: '42P01',
    });
    let attempts = 0;
    const client = clientWithRun(async () => {
      attempts += 1;
      throw failure;
    });

    await expect(
      applyKvStorageOptimizations(client, log, {
        allowTemporarilyUnavailableTable: true,
      })
    ).resolves.toBe(undefined);
    expect(attempts).toBe(1);
  });

  test('does not hide an unexpected storage DDL failure', async () => {
    const failure = Object.assign(new Error('permission denied'), {
      code: '42501',
    });
    const client = clientWithRun(async () => {
      throw failure;
    });

    await expect(applyKvStorageOptimizations(client, log)).rejects.toBe(
      failure
    );
  });
});
