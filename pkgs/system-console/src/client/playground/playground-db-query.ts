import { ident, sql } from '@pkgs/sql';
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
    const rows = await sqlClient.query<Record<string, unknown>>(
      sql`SELECT * FROM ${ident(tableName)} LIMIT 100`
    );
    const columns =
      rows.length > 0
        ? Object.keys(rows[0] as Record<string, unknown>).sort()
        : await loadColumnNames(sqlClient, tableName);
    return { columns, rows, error: null };
  } catch (err) {
    return {
      columns: [],
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function loadColumnNames(
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
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
