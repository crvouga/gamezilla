import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';
import { LOCAL_DOMAIN_TABLE_NAMES } from '../root/app-schema';

/**
 * Legacy cutover: domain tables created before `@pkgs/db-schema` reconcile may
 * have NOT NULL on non-PK columns. Reconcile requires nullable non-PK columns.
 */
export class DomainSchemaNullabilityMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const tableNames = [...LOCAL_DOMAIN_TABLE_NAMES];
    for (const name of tableNames) {
      assertValidTableName(name);
    }

    const arrayLiteral = tableNames.map((n) => `'${n}'`).join(', ');

    const pending = await ctx.sqlClient.query<{ count: string }>(
      unsafe(`
      SELECT count(*)::text AS count
      FROM information_schema.columns c
      WHERE c.table_schema = current_schema()
        AND c.table_name IN (${arrayLiteral})
        AND c.is_nullable = 'NO'
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = c.table_schema
            AND kcu.table_name = c.table_name
            AND kcu.column_name = c.column_name
        )
    `)
    );

    const count = Number(pending[0]?.count ?? '0');
    if (count === 0) {
      ctx.logger.info('domain schema nullability already compatible');
      return;
    }

    await ctx.sqlClient.run(
      unsafe(`
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name IN (${arrayLiteral})
      AND c.is_nullable = 'NO'
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = c.table_schema
          AND kcu.table_name = c.table_name
          AND kcu.column_name = c.column_name
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',
      r.table_name,
      r.column_name
    );
  END LOOP;
END $$;
`)
    );

    ctx.logger.info(
      'dropped NOT NULL on non-PK domain columns (legacy cutover)',
      {
        count,
      }
    );
  }
}

function assertValidTableName(name: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`invalid domain table name: ${name}`);
  }
}
