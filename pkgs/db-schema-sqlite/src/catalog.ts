// @sql-vendor-ok — SQLite schema reconcile uses PRAGMA table_info / index_*.

import { normalizeSqliteType } from '@pkgs/db-schema/core/type-map';
import type {
  IntrospectedCatalog,
  IntrospectedCheck,
  IntrospectedForeignKey,
  IntrospectedIndex,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
} from '@pkgs/db-schema/core/types';
import { raw } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

const CHECK_CONSTRAINT_RE =
  /CONSTRAINT\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+CHECK\s*\(/gi;

function quoteSqliteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`unsafe sqlite identifier: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function parseChecksFromCreateSql(
  table: string,
  createSql: string | null
): IntrospectedCheck[] {
  if (createSql === null) return [];
  const out: IntrospectedCheck[] = [];
  for (const match of createSql.matchAll(CHECK_CONSTRAINT_RE)) {
    const name = match[1];
    if (name !== undefined) {
      out.push({ name, table });
    }
  }
  return out;
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
  readonly declaredSet: ReadonlySet<string>;
}): Promise<{
  readonly table: IntrospectedTable;
  readonly indexes: readonly IntrospectedIndex[];
  readonly checks: readonly IntrospectedCheck[];
  readonly foreignKeys: readonly IntrospectedForeignKey[];
}> {
  const { client, name, declaredSet } = args;
  const q = quoteSqliteIdent(name);
  const colRows = await client.query<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>(raw(`PRAGMA table_info(${q})`));

  const table: IntrospectedTable = {
    name,
    columns: colRows.map((c) => ({
      name: c.name,
      type: normalizeSqliteType(c.type) ?? c.type,
      nullable: c.notnull === 0,
      isPrimaryKey: c.pk > 0,
    })),
  };

  const checks: IntrospectedCheck[] = [];
  const foreignKeys: IntrospectedForeignKey[] = [];
  if (declaredSet.has(name)) {
    const ddlRows = await client.query<{ sql: string | null }>(
      raw(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${name.replace(/'/g, "''")}'`
      )
    );
    checks.push(...parseChecksFromCreateSql(name, ddlRows[0]?.sql ?? null));

    const fkRows = await client.query<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
      match: string;
    }>(raw(`PRAGMA foreign_key_list(${q})`));
    for (const fk of fkRows) {
      foreignKeys.push({
        name: `fk_${name}_${fk.from}`,
        table: name,
        column: fk.from,
        refTable: fk.table,
        refColumn: fk.to,
      });
    }
  }

  const indexes = await readTableIndexes(client, name);
  return { table, indexes, checks, foreignKeys };
}

/**
 * Introspect the SQLite database for schema reconciliation.
 */
export async function readSqliteCatalog(
  client: SqlClient,
  declared: ReadonlyDeclaredSchema
): Promise<IntrospectedCatalog> {
  const declaredSet = new Set(Object.keys(declared.tables));
  const tableRows = await client.query<{ name: string }>(
    raw(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
  );
  const allTableNames = new Set(tableRows.map((r) => r.name));
  const tables = new Map<string, IntrospectedTable>();
  const indexes: IntrospectedIndex[] = [];
  const checks: IntrospectedCheck[] = [];
  const foreignKeys: IntrospectedForeignKey[] = [];

  for (const { name } of tableRows) {
    const part = await introspectSqliteTable({
      client,
      name,
      declaredSet,
    });
    tables.set(name, part.table);
    indexes.push(...part.indexes);
    checks.push(...part.checks);
    foreignKeys.push(...part.foreignKeys);
  }

  const viewRows = await client.query<{ name: string }>(
    raw(`SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name`)
  );
  const views = viewRows.map((r) => ({ name: r.name }));

  return {
    tables,
    indexes,
    allTableNames,
    checks,
    foreignKeys,
    views,
  };
}
