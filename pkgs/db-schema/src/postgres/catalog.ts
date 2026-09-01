// @sql-vendor-ok — Postgres schema reconcile uses information_schema / pg_advisory_*.
import type { Sql } from '@pkgs/sql';
import { raw, sql } from '@pkgs/sql';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { quotePgIdent } from '@pkgs/sql-client/postgres/schema';
import { pgTypeToToken } from '../core/type-map';
import type {
  IntrospectedCatalog,
  IntrospectedIndex,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
} from '../core/types';

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
  }>(sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable
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
      nullable: boolean;
      isPrimaryKey: boolean;
    }[]
  >();

  for (const row of colRows) {
    if (!declaredSet.has(row.table_name)) continue;
    const token = pgTypeToToken(row.udt_name, row.data_type);
    const cols = byTable.get(row.table_name) ?? [];
    cols.push({
      name: row.column_name,
      type: token ?? row.udt_name,
      nullable: row.is_nullable === 'YES',
      isPrimaryKey: pkSet.has(`${row.table_name}.${row.column_name}`),
    });
    byTable.set(row.table_name, cols);
  }
  for (const [name, columns] of byTable) {
    tables.set(name, { name, columns });
  }
  return tables;
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

  const indexes: IntrospectedIndex[] = [];
  for (const row of indexRows) {
    if (!declaredSet.has(row.tablename)) continue;
    const match = /\(([^)]+)\)\s*$/.exec(row.indexdef);
    const columns = match
      ? match[1]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      : [];
    indexes.push({
      name: row.indexname,
      table: row.tablename,
      columns,
    });
  }
  return indexes;
}

async function readPostgresForeignKeys(
  client: PostgresSqlClient,
  schemaName: string,
  declaredSet: ReadonlySet<string>
): Promise<NonNullable<IntrospectedCatalog['foreignKeys']>> {
  try {
    const fkRows = await client.query<{
      constraint_name: string;
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(sql`
      SELECT
        c.conname AS constraint_name,
        t.relname AS table_name,
        a.attname AS column_name,
        ft.relname AS foreign_table_name,
        fa.attname AS foreign_column_name
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      JOIN pg_attribute a
        ON a.attrelid = t.oid
       AND a.attnum = ANY(c.conkey)
       AND a.attnum > 0
       AND NOT a.attisdropped
      JOIN pg_class ft ON c.confrelid = ft.oid
      JOIN pg_attribute fa
        ON fa.attrelid = ft.oid
       AND fa.attnum = ANY(c.confkey)
       AND fa.attnum > 0
       AND NOT fa.attisdropped
      WHERE c.contype = 'f'
        AND n.nspname = ${schemaName}
    `);
    return fkRows
      .filter((r) => declaredSet.has(r.table_name))
      .map((r) => ({
        name: r.constraint_name,
        table: r.table_name,
        column: r.column_name,
        refTable: r.foreign_table_name,
        refColumn: r.foreign_column_name,
      }));
  } catch {
    return [];
  }
}

async function readPostgresEnums(
  client: PostgresSqlClient,
  schemaName: string
): Promise<NonNullable<IntrospectedCatalog['enums']>> {
  try {
    const enumRows = await client.query<{
      typname: string;
      enumlabel: string;
    }>(sql`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ${schemaName}
      ORDER BY t.typname, e.enumsortorder
    `);
    const enumMap = new Map<string, string[]>();
    for (const row of enumRows) {
      const vals = enumMap.get(row.typname) ?? [];
      vals.push(row.enumlabel);
      enumMap.set(row.typname, vals);
    }
    return [...enumMap.entries()].map(([name, values]) => ({
      name,
      values,
    }));
  } catch {
    return [];
  }
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

  const checkRows = await client.query<{
    table_name: string;
    constraint_name: string;
  }>(sql`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = ${schemaName}
      AND tc.constraint_type = 'CHECK'
  `);
  const checks = checkRows
    .filter((r) => declaredSet.has(r.table_name))
    .map((r) => ({
      name: r.constraint_name,
      table: r.table_name,
    }));

  const foreignKeys = await readPostgresForeignKeys(
    client,
    schemaName,
    declaredSet
  );

  let views: IntrospectedCatalog['views'] = [];
  try {
    const viewRows = await client.query<{ table_name: string }>(sql`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = ${schemaName}
    `);
    views = viewRows.map((r) => ({ name: r.table_name }));
  } catch {
    views = [];
  }

  const enums = await readPostgresEnums(client, schemaName);

  return {
    tables,
    indexes,
    allTableNames,
    checks,
    foreignKeys,
    views,
    enums,
  };
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
