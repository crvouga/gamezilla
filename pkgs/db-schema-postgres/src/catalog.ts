// @sql-vendor-ok — Postgres schema reconcile uses information_schema / pg_advisory_*.

import { pgTypeToToken } from '@pkgs/db-schema/core/type-map';
import type {
  IntrospectedCatalog,
  IntrospectedIndex,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
} from '@pkgs/db-schema/core/types';
import { raw, type Sql, sql } from '@pkgs/sql';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { quotePgIdent } from '@pkgs/sql-client/postgres-db-scope';

async function readDeclaredPostgresTables(
  client: PostgresSqlClient,
  schemaName: string,
  declaredSet: ReadonlySet<string>
): Promise<Map<string, IntrospectedTable>> {
  const tables = new Map<string, IntrospectedTable>();
  if (declaredSet.size === 0) return tables;

  const colRows = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = ${schemaName}
    ORDER BY table_name, ordinal_position
  `);

  const pkRows = await client.query<{
    table_name: string;
    column_name: string;
  }>(sql`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = ${schemaName}
      AND tc.constraint_type = 'PRIMARY KEY'
  `);
  const pkSet = new Set(pkRows.map((r) => `${r.table_name}.${r.column_name}`));

  const byTable = new Map<
    string,
    {
      name: string;
      type: string;
      physical: string;
      nullable: boolean;
      isPrimaryKey: boolean;
      columnDefault: string | null;
    }[]
  >();

  for (const row of colRows) {
    if (!declaredSet.has(row.table_name)) continue;
    const token = pgTypeToToken(row.udt_name, row.data_type);
    const cols = byTable.get(row.table_name) ?? [];
    cols.push({
      name: row.column_name,
      type: token ?? row.udt_name,
      physical: row.udt_name,
      nullable: row.is_nullable === 'YES',
      isPrimaryKey: pkSet.has(`${row.table_name}.${row.column_name}`),
      columnDefault: row.column_default,
    });
    byTable.set(row.table_name, cols);
  }
  for (const [name, columns] of byTable) {
    tables.set(name, { name, columns });
  }
  return tables;
}

async function readInvalidIndexNames(
  client: PostgresSqlClient,
  schemaName: string
): Promise<ReadonlySet<string>> {
  try {
    const rows = await client.query<{ name: string }>(sql`
      SELECT c.relname AS name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${schemaName}
        AND NOT i.indisvalid
    `);
    return new Set(rows.map((r) => r.name));
  } catch {
    // Engines without pg_index (mockingbird-postgres) cannot report a failed
    // CONCURRENTLY build; nothing is marked invalid.
    return new Set<string>();
  }
}

async function readPostgresIndexes(
  client: PostgresSqlClient,
  schemaName: string,
  declaredSet: ReadonlySet<string>
): Promise<IntrospectedIndex[]> {
  const indexRows = await client.query<{
    indexname: string;
    tablename: string;
    indexdef: string;
  }>(sql`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = ${schemaName}
  `);
  const invalid = await readInvalidIndexNames(client, schemaName);

  const indexes: IntrospectedIndex[] = [];
  for (const row of indexRows) {
    if (!declaredSet.has(row.tablename)) continue;
    const match = /\(([^)]+)\)\s*(?:WHERE.*)?$/.exec(row.indexdef);
    const columns = match
      ? match[1]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      : [];
    indexes.push({
      name: row.indexname,
      table: row.tablename,
      columns,
      ...(invalid.has(row.indexname) ? { invalid: true } : {}),
    });
  }
  return indexes;
}

export async function readPostgresCatalog(
  client: PostgresSqlClient,
  declared: ReadonlyDeclaredSchema
): Promise<IntrospectedCatalog> {
  const schemaName = client.dbScope.schema;
  const declaredSet = new Set(Object.keys(declared.tables));

  const allTables = await client.query<{ table_name: string }>(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schemaName}
      AND table_type = 'BASE TABLE'
  `);
  const allTableNames = new Set(allTables.map((r) => r.table_name));

  const tables = await readDeclaredPostgresTables(
    client,
    schemaName,
    declaredSet
  );
  const indexes = await readPostgresIndexes(client, schemaName, declaredSet);

  return { tables, indexes, allTableNames };
}

export function createSchemaSql(schemaName: string): Sql<unknown> {
  return raw(`CREATE SCHEMA IF NOT EXISTS ${quotePgIdent(schemaName)}`);
}

/** Fixed package advisory lock keys (session-level). */
export const ADVISORY_LOCK_CLASS = 882_771;
export const ADVISORY_LOCK_ID = 1;

export function advisoryLockSql(): Sql<Record<string, unknown>> {
  return sql`SELECT pg_advisory_lock(${ADVISORY_LOCK_CLASS}, ${ADVISORY_LOCK_ID}) AS locked`;
}

export function advisoryUnlockSql(): Sql<Record<string, unknown>> {
  return sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_CLASS}, ${ADVISORY_LOCK_ID}) AS unlocked`;
}
