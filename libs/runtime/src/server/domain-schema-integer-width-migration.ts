import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import type { Snapshot } from '@pkgs/db-schema';
import { unsafe } from '@pkgs/sql';

/**
 * Legacy cutover: domain columns created before `@pkgs/db-schema` compared
 * physical types may be `int4` / `int2`, while a declared `integer` is
 * physical `bigint`. Reconcile never ALTERs a type, so it rejects them as
 * drift. Widening to `bigint` is lossless and invisible on the wire (the
 * logical type stays `integer`, so clients never see the change).
 *
 * Only columns declared `integer` with no Postgres physical override are
 * touched — live or retired alike.
 */
export class DomainSchemaIntegerWidthMigration implements DatabaseMigration {
  constructor(private readonly snapshot: Snapshot) {}

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const declared = bigintColumns(this.snapshot);
    const tableNames = [...new Set(declared.map((c) => c.table))];
    if (tableNames.length === 0) {
      return;
    }
    for (const name of tableNames) {
      assertValidIdent(name);
    }
    const arrayLiteral = tableNames.map((n) => `'${n}'`).join(', ');

    const narrow = await ctx.sqlClient.query<{
      table_name: string;
      column_name: string;
    }>(
      unsafe(`
      SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = current_schema()
        AND c.table_name IN (${arrayLiteral})
        AND c.udt_name IN ('int2', 'int4')
    `)
    );

    const wanted = new Set(declared.map((c) => `${c.table}.${c.column}`));
    const targets = narrow.filter((r) =>
      wanted.has(`${r.table_name}.${r.column_name}`)
    );
    if (targets.length === 0) {
      ctx.logger.info('domain schema integer width already compatible');
      return;
    }

    for (const target of targets) {
      assertValidIdent(target.column_name);
      await ctx.sqlClient.run(
        unsafe(
          `ALTER TABLE "${target.table_name}" ALTER COLUMN "${target.column_name}" TYPE bigint`
        )
      );
    }

    ctx.logger.info('widened legacy int4 domain columns to bigint', {
      columns: targets.map((t) => `${t.table_name}.${t.column_name}`),
    });
  }
}

function bigintColumns(
  snapshot: Snapshot
): { readonly table: string; readonly column: string }[] {
  const out: { table: string; column: string }[] = [];
  const add = (table: string, column: string): void => {
    if (snapshot.physicalOverrides[table]?.[column]?.postgres !== undefined) {
      return;
    }
    out.push({ table, column });
  };
  for (const [table, columns] of Object.entries(snapshot.tables)) {
    for (const [column, type] of Object.entries(columns)) {
      if (type === 'integer') add(table, column);
    }
  }
  for (const [table, columns] of Object.entries(snapshot.retiredColumns)) {
    for (const [column, retired] of Object.entries(columns)) {
      if (retired.type === 'integer') add(table, column);
    }
  }
  return out;
}

function assertValidIdent(name: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`invalid domain identifier: ${name}`);
  }
}
