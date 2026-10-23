import { expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server-ts/start';
import { SQL } from 'bun';

// Literal upstream failures stay red until Mockingbird implements PostgreSQL's DDL/catalog.
const cases = [
  // regression: mockingbird-postgres-set-not-null
  'ALTER TABLE example ALTER COLUMN body SET NOT NULL',
  // regression: mockingbird-postgres-set-default
  'ALTER TABLE example ALTER COLUMN created_at SET DEFAULT now()',
  // regression: mockingbird-postgres-table-statistics
  'SELECT relid, n_live_tup FROM pg_stat_user_tables',
  // regression: mockingbird-postgres-index-validity
  'SELECT i.indisvalid FROM pg_index i',
  // regression: mockingbird-postgres-regnamespace
  'SELECT current_schema()::regnamespace::text AS schema',
  // regression: mockingbird-postgres-index-definitions
  'SELECT pg_get_indexdef(0) AS definition',
  // regression: mockingbird-postgres-index-comments
  'SELECT objoid, description FROM pg_description',
  // regression: mockingbird-postgres-index-statistics
  'SELECT indexrelname, idx_scan FROM pg_stat_user_indexes',
];

for (const statement of cases) {
  test(statement, async () => {
    const server = await startMockingbirdPostgres({
      port: 0,
      store: new ObjectStoreImplInMemory(),
    });
    const client = new SQL({ url: server.url, max: 1 });
    try {
      await client.unsafe(
        'CREATE TABLE example (body text, created_at timestamptz)'
      );
      expect(await client.unsafe(statement)).toBeDefined();
    } finally {
      await client.close();
      await server.stop();
    }
  });
}
