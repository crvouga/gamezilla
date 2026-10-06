import { expect, test } from 'bun:test';
import { postgres } from '@pkgs/db-schema-postgres-shared/driver';
import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { createRecordingPostgresClient } from '@pkgs/db-schema-root-shared/fake-sql-client';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';

// regression: postgres-catalog-error-hidden-by-aborted-transaction
test('reconciliation preserves the first catalog error and stops issuing DDL', async () => {
  const original = Object.assign(
    new Error('column "i.indisvalid" does not exist'),
    {
      code: 'XX000',
    }
  );
  const client = createRecordingPostgresClient(
    createPostgresDbScope('public'),
    {
      async query(statement) {
        if (statement.sql.includes('i.indisvalid')) throw original;
        return [];
      },
    }
  );
  const schema = registerTables([
    defineTable({ domain: 'notes', name: 'notes', columns: { body: 'text' } }),
  ]);

  await expect(
    postgres(schema, client, {
      skipAdvisoryLock: true,
      alreadyInTransaction: true,
    }).reconcile()
  ).rejects.toBe(original);
  expect(client.calls.at(-1)?.sql).toContain('i.indisvalid');
  expect(client.runCalls.some((call) => /CREATE TABLE/i.test(call.sql))).toBe(
    false
  );
});
