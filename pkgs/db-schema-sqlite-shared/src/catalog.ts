// @sql-vendor-ok — SQLite schema reconcile uses PRAGMA table_info / index_*.

import { normalizeSqliteType } from '@pkgs/db-schema-shared/type-map';
import type {
  IntrospectedCatalog,
  IntrospectedIndex,
  IntrospectedTable,
} from '@pkgs/db-schema-shared/types';
import { raw } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

function quoteSqliteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`unsafe sqlite identifier: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

async function readTableIndexes(
  client: SqlClient,
  tableName: string
): Promise<IntrospectedIndex[]> {
  const q = quoteSqliteIdent(tableName);
  const ixList = await client.query<{ name: string; origin: string }>(
    raw(`PRAGMA index_list(${q})`)
  );
  const indexes: IntrospectedIndex[] = [];
  for (const ix of ixList) {
    if (ix.origin === 'pk') continue;
    const ixInfo = await client.query<{ name: string }>(
      raw(`PRAGMA index_info(${quoteSqliteIdent(ix.name)})`)
    );
    indexes.push({
      name: ix.name,
      table: tableName,
      columns: ixInfo.map((r) => r.name),
    });
  }
  return indexes;
}

async function introspectSqliteTable(args: {
  readonly client: SqlClient;
  readonly name: string;
}): Promise<{
  readonly table: IntrospectedTable;
  readonly indexes: readonly IntrospectedIndex[];
}> {
  const { client, name } = args;
  const q = quoteSqliteIdent(name);
  const colRows = await client.query<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>(raw(`PRAGMA table_info(${q})`));

  const table: IntrospectedTable = {
    name,
    columns: colRows.map((c) => {
      const physical = normalizeSqliteType(c.type) ?? c.type.toUpperCase();
      return {
        name: c.name,
        type: physical,
        physical,
        nullable: c.notnull === 0,
        isPrimaryKey: c.pk > 0,
      };
    }),
  };

  const indexes = await readTableIndexes(client, name);
  return { table, indexes };
}

/**
 * Introspect the SQLite database for schema reconciliation.
 */
export async function readSqliteCatalog(
  client: SqlClient
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
    const part = await introspectSqliteTable({ client, name });
    tables.set(name, part.table);
    indexes.push(...part.indexes);
  }

  return { tables, indexes, allTableNames };
}
