import { ident, sql } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import {
  Box,
  Button,
  ErrorState,
  LoadingState,
  Pressable,
  ScrollView,
  Text,
} from '@pkgs/ui';
import { useEffect, useState } from 'react';

type SchemaRow = {
  readonly name: string;
  readonly type: string;
};

type ReadyState = {
  readonly status: 'ready';
  readonly tables: readonly SchemaRow[];
  readonly selected: string | null;
  readonly columns: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
  readonly rowError: string | null;
};

type DbState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | ReadyState;

/**
 * Live SQL browser for a playground node: table list + SELECT * LIMIT 100.
 * Postgres ({@link PostgresSqlClient} / `dbScope`) uses information_schema;
 * otherwise SQLite/AlaSQL catalog (`sqlite_master` / PRAGMA).
 */
export function PlaygroundDbPane(props: { readonly sqlClient: SqlClient }) {
  const { sqlClient } = props;
  const [state, setState] = useState<DbState>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadSchema(sqlClient, (next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sqlClient, tick]);

  if (state.status === 'loading') {
    return (
      <Box sx={paneFillSx}>
        <LoadingState variant="compact" caption="Loading schema…" />
      </Box>
    );
  }

  if (state.status === 'error') {
    return (
      <Box sx={paneFillSx}>
        <ErrorState title="DB error" body={state.message} />
        <Button
          title="Retry"
          size="sm"
          intent="neutral"
          variant="outline"
          onPress={() => setTick((n) => n + 1)}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, flexDirection: 'row' }}>
      <TableList
        tables={state.tables}
        selected={state.selected}
        onRefresh={() => setTick((n) => n + 1)}
        onSelect={(name) => {
          void selectTable(sqlClient, name, setState);
        }}
      />
      <TablePreview state={state} />
    </Box>
  );
}

function TableList(props: {
  readonly tables: readonly SchemaRow[];
  readonly selected: string | null;
  readonly onRefresh: () => void;
  readonly onSelect: (name: string) => void;
}) {
  return (
    <Box
      sx={{
        width: 140,
        flexShrink: 0,
        borderRightWidth: 1,
        borderColor: 'border',
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderColor: 'border',
        }}
      >
        <Text sx={{ color: 'textSecondary', fontSize: 10, fontWeight: '600' }}>
          Tables
        </Text>
        <Button
          title="Refresh"
          size="sm"
          intent="neutral"
          variant="ghost"
          onPress={props.onRefresh}
        />
      </Box>
      <ScrollView
        frameSx={{ flex: 1, minHeight: 0 }}
        sx={{ padding: 4, gap: 1 }}
      >
        {props.tables.length === 0 ? (
          <Text sx={{ color: 'textSecondary', fontSize: 11, padding: 4 }}>
            No tables yet.
          </Text>
        ) : (
          props.tables.map((t) => {
            const active = t.name === props.selected;
            return (
              <Pressable
                key={t.name}
                onPress={() => props.onSelect(t.name)}
                sx={{
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  borderRadius: 'md',
                  background: active ? 'tintSubtle' : 'transparent',
                }}
              >
                <Text
                  sx={{
                    color: active ? 'tint' : 'text',
                    fontSize: 11,
                    fontWeight: active ? '600' : '400',
                  }}
                  numberOfLines={1}
                >
                  {t.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Box>
  );
}

function TablePreview(props: { readonly state: ReadyState }) {
  const { state } = props;
  if (state.rowError != null) {
    return <ErrorState title="Query failed" body={state.rowError} />;
  }
  if (state.selected == null) {
    return (
      <Text sx={{ color: 'textSecondary', fontSize: 12, padding: 8 }}>
        Select a table.
      </Text>
    );
  }
  return (
    <ScrollView
      horizontal
      frameSx={{ flex: 1, minHeight: 0 }}
      sx={{ minHeight: 0 }}
    >
      <ScrollView frameSx={{ flex: 1, minHeight: 0 }} sx={{ padding: 4 }}>
        <Box sx={{ flexDirection: 'row', gap: 2, paddingBottom: 4 }}>
          {state.columns.map((col) => (
            <Text
              key={col}
              sx={{
                color: 'textSecondary',
                fontSize: 10,
                fontWeight: '600',
                width: 120,
                flexShrink: 0,
              }}
            >
              {col}
            </Text>
          ))}
        </Box>
        {state.rows.length === 0 ? (
          <Text sx={{ color: 'textSecondary', fontSize: 11, padding: 4 }}>
            Empty table.
          </Text>
        ) : (
          state.rows.map((row, i) => (
            <Box
              key={i}
              sx={{
                flexDirection: 'row',
                gap: 2,
                paddingVertical: 3,
                borderBottomWidth: 1,
                borderColor: 'border',
              }}
            >
              {state.columns.map((col) => (
                <Text
                  key={col}
                  sx={{
                    color: 'text',
                    fontSize: 11,
                    width: 120,
                    flexShrink: 0,
                  }}
                  numberOfLines={2}
                >
                  {formatCell(row[col])}
                </Text>
              ))}
            </Box>
          ))
        )}
      </ScrollView>
    </ScrollView>
  );
}

async function loadSchema(
  sqlClient: SqlClient,
  setState: (next: DbState) => void
): Promise<void> {
  setState({ status: 'loading' });
  try {
    const tables = await listTables(sqlClient);
    const selected = tables[0]?.name ?? null;
    if (selected == null) {
      setState({
        status: 'ready',
        tables,
        selected: null,
        columns: [],
        rows: [],
        rowError: null,
      });
      return;
    }
    const preview = await loadTablePreview(sqlClient, selected);
    setState({
      status: 'ready',
      tables,
      selected,
      columns: preview.columns,
      rows: preview.rows,
      rowError: preview.error,
    });
  } catch (err) {
    setState({
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function selectTable(
  sqlClient: SqlClient,
  name: string,
  setState: (updater: (prev: DbState) => DbState) => void
): Promise<void> {
  const preview = await loadTablePreview(sqlClient, name);
  setState((prev) => {
    if (prev.status !== 'ready') return prev;
    return {
      ...prev,
      selected: name,
      columns: preview.columns,
      rows: preview.rows,
      rowError: preview.error,
    };
  });
}

function isPostgresSqlClient(
  sqlClient: SqlClient
): sqlClient is PostgresSqlClient {
  return 'dbScope' in sqlClient;
}

async function listTables(sqlClient: SqlClient): Promise<readonly SchemaRow[]> {
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

async function loadTablePreview(
  sqlClient: SqlClient,
  tableName: string
): Promise<{
  readonly columns: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
  readonly error: string | null;
}> {
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

function formatCell(value: unknown): string {
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

const paneFillSx = {
  flex: 1,
  minHeight: 0,
  padding: 8,
  gap: 2,
} as const;
