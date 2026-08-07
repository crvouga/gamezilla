import { raw } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { normalizeSqliteType } from '../core/type-map';
import type {
  IntrospectedCatalog,
  IntrospectedIndex,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
} from '../core/types';

function quoteSqliteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`unsafe sqlite identifier: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Introspect the entire SQLite database. The bound database is wholly owned
 * by this package — see the sqlite driver docs.
 */
export async function readSqliteCatalog(
  client: SqlClient,
  _declared: ReadonlyDeclaredSchema
): Promise<IntrospectedCatalog> {
  const tableRows = await client.query<{ name: string }>(
    raw(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
  );
  const allTableNames = new Set(tableRows.map((r) => r.name));
  const tables = new Map<string, IntrospectedTable>();
  const indexes: IntrospectedIndex[] = [];

  for (const { name } of tableRows) {
    const q = quoteSqliteIdent(name);
    const colRows = await client.query<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>(raw(`PRAGMA table_info(${q})`));

    tables.set(name, {
      name,
      columns: colRows.map((c) => ({
        name: c.name,
        type: normalizeSqliteType(c.type) ?? c.type,
        nullable: c.notnull === 0,
        isPrimaryKey: c.pk > 0,
      })),
    });

    const ixList = await client.query<{ name: string; origin: string }>(
      raw(`PRAGMA index_list(${q})`)
    );
    for (const ix of ixList) {
      if (ix.origin === 'pk') continue;
      const ixInfo = await client.query<{ name: string }>(
        raw(`PRAGMA index_info(${quoteSqliteIdent(ix.name)})`)
      );
      indexes.push({
        name: ix.name,
        table: name,
        columns: ixInfo.map((r) => r.name),
      });
    }
  }

  return { tables, indexes, allTableNames };
}
