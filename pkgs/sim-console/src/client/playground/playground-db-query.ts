import { empty, ident, raw, sql } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';

export type SchemaRow = {
  readonly name: string;
  readonly type: string;
};

export type TablePreview = {
  readonly columns: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
  readonly error: string | null;
};

function isPostgresSqlClient(
  sqlClient: SqlClient
): sqlClient is PostgresSqlClient {
  return 'dbScope' in sqlClient;
}

export async function listPlaygroundTables(
  sqlClient: SqlClient
): Promise<readonly SchemaRow[]> {
  if (isPostgresSqlClient(sqlClient)) {
    return sqlClient.query<SchemaRow>(sql`
      SELECT
        CASE table_type
          WHEN 'BASE TABLE' THEN 'table'
          ELSE 'view'
        END AS type,
        table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY
        CASE table_type WHEN 'BASE TABLE' THEN 0 ELSE 1 END,
        table_name
    `);
  }
  return sqlClient.query<SchemaRow>(sql`
    SELECT type, name FROM sqlite_master
    WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
    ORDER BY
      CASE type WHEN 'table' THEN 0 ELSE 1 END,
      name
  `);
}

export async function loadPlaygroundTablePreview(
  sqlClient: SqlClient,
  tableName: string
): Promise<TablePreview> {
  try {
    const columns = await loadColumnNames(sqlClient, tableName);
    const rows = await sqlClient.query<Record<string, unknown>>(
      sql`SELECT * FROM ${ident(tableName)} LIMIT 100`
    );
    return { columns, rows, error: null };
  } catch (err) {
    return {
      columns: [],
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type PlaygroundTablePageParams = {
  readonly offset: number;
  readonly limit: number;
  readonly orderBy: string | null;
  readonly orderDir: 'asc' | 'desc';
};

export type PlaygroundTablePage = {
  readonly rows: readonly Record<string, unknown>[];
  readonly totalCount: number;
};

/** Paged table read for DataTable `loadPage` (LIMIT/OFFSET + optional ORDER BY). */
export async function loadPlaygroundTablePage(
  sqlClient: SqlClient,
  tableName: string,
  params: PlaygroundTablePageParams
): Promise<PlaygroundTablePage> {
  const { offset, limit, orderBy, orderDir } = params;
  const countRows = await sqlClient.query<{ count: number }>(
    sql`SELECT COUNT(*) AS count FROM ${ident(tableName)}`
  );
  const totalCount = Number(countRows[0]?.count ?? 0);
  const dir = orderDir === 'desc' ? raw('DESC') : raw('ASC');
  const orderClause =
    orderBy != null ? sql` ORDER BY ${ident(orderBy)} ${dir}` : empty;
  const rows = await sqlClient.query<Record<string, unknown>>(
    sql`SELECT * FROM ${ident(tableName)}${orderClause} LIMIT ${limit} OFFSET ${offset}`
  );
  return { rows, totalCount };
}

export async function loadColumnNames(
  sqlClient: SqlClient,
  tableName: string
): Promise<readonly string[]> {
  try {
    if (isPostgresSqlClient(sqlClient)) {
      const info = await sqlClient.query<{ name: string }>(sql`
        SELECT column_name AS name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position
      `);
      return info.map((r) => r.name);
    }
    const info = await sqlClient.query<{ name: string }>(
      sql`PRAGMA table_info(${ident(tableName)})`
    );
    return info.map((r) => r.name);
  } catch {
    return [];
  }
}

export function formatPlaygroundDbCell(value: unknown): string {
  if (value == null) return 'NULL';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
