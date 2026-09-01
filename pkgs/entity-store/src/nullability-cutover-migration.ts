import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';

import { ENTITY_STORE_TABLE } from './schema/tables';

/**
 * One-shot cutover: drop NOT NULL on non-PK columns so PostgresSchema reconcile
 * can add `deleted_at` and match defineTable nullability. No-op on fresh DBs.
 */
export class EntityStoreNullabilityCutoverMigration
  implements DatabaseMigration
{
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const existing = await ctx.sqlClient.query<{ one: number }>(
      unsafe(`
        SELECT 1 AS one
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = '${ENTITY_STORE_TABLE}'
        LIMIT 1
      `)
    );
    if (existing.length === 0) {
      ctx.logger.info('entity_store cutover: table missing (fresh DB)');
      return;
    }

    await ctx.sqlClient.run(
      unsafe(`
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = '${ENTITY_STORE_TABLE}'
      AND c.is_nullable = 'NO'
      AND c.column_name <> 'id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',
      '${ENTITY_STORE_TABLE}',
      r.column_name
    );
  END LOOP;
END $$;
`)
    );
    ctx.logger.info('entity_store cutover: dropped NOT NULL on non-PK columns');
  }
}
