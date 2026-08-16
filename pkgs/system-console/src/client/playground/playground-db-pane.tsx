import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  Box,
  Button,
  ErrorState,
  LoadingState,
  Pressable,
  ScrollView,
  Text,
  useTheme,
} from '@pkgs/ui';
import { useEffect, useState } from 'react';

import {
  formatPlaygroundDbCell,
  listPlaygroundTables,
  loadPlaygroundTablePreview,
  type SchemaRow,
} from './playground-db-query';

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
 * Narrow breakpoints stack a chip picker + row cards; desktop keeps rail + grid.
 */
export function PlaygroundDbPane(props: { readonly sqlClient: SqlClient }) {
  const { sqlClient } = props;
  const { breakpoint } = useTheme();
  const narrow = breakpoint === 'mobile' || breakpoint === 'tablet';
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

  const onSelect = (name: string) => {
    void selectTable(sqlClient, name, setState);
  };
  const onRefresh = () => setTick((n) => n + 1);

  if (narrow) {
    return (
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <TableChipPicker
          tables={state.tables}
          selected={state.selected}
          onRefresh={onRefresh}
          onSelect={onSelect}
        />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <RowCardPreview state={state} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, flexDirection: 'row' }}>
      <TableRail
        tables={state.tables}
        selected={state.selected}
        onRefresh={onRefresh}
        onSelect={onSelect}
      />
      <GridPreview state={state} />
    </Box>
  );
}

function TableChipPicker(props: {
  readonly tables: readonly SchemaRow[];
  readonly selected: string | null;
  readonly onRefresh: () => void;
  readonly onSelect: (name: string) => void;
}) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        borderBottomWidth: 1,
        borderColor: 'border',
        paddingVertical: 6,
        gap: 2,
      }}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 8,
        }}
      >
        <Text sx={{ color: 'textSecondary', fontSize: 10, fontWeight: '600' }}>
          {props.selected ?? 'Tables'}
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
        horizontal
        frameSx={{ flexGrow: 0 }}
        sx={{ paddingHorizontal: 6, gap: 1, flexDirection: 'row' }}
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
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 'md',
                  background: active ? 'tintSubtle' : 'background',
                  flexShrink: 0,
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

function TableRail(props: {
  readonly tables: readonly SchemaRow[];
  readonly selected: string | null;
  readonly onRefresh: () => void;
  readonly onSelect: (name: string) => void;
}) {
  return (
    <Box
      sx={{
        width: 180,
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

function RowCardPreview(props: { readonly state: ReadyState }) {
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
  if (state.rows.length === 0) {
    return (
      <Text sx={{ color: 'textSecondary', fontSize: 11, padding: 8 }}>
        Empty table.
      </Text>
    );
  }
  return (
    <ScrollView frameSx={{ flex: 1, minHeight: 0 }} sx={{ padding: 6, gap: 2 }}>
      {state.rows.map((row, i) => (
        <Box
          key={i}
          sx={{
            borderWidth: 1,
            borderColor: 'border',
            borderRadius: 'md',
            padding: 8,
            gap: 1.5,
            background: 'surface',
          }}
        >
          <Text
            sx={{ color: 'textSecondary', fontSize: 10, fontWeight: '600' }}
          >
            Row {i + 1}
          </Text>
          {state.columns.map((col) => (
            <Box key={col} sx={{ gap: 0.5 }}>
              <Text
                sx={{ color: 'textSecondary', fontSize: 10, fontWeight: '600' }}
              >
                {col}
              </Text>
              <Text sx={{ color: 'text', fontSize: 12 }} numberOfLines={4}>
                {formatPlaygroundDbCell(row[col])}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </ScrollView>
  );
}

function GridPreview(props: { readonly state: ReadyState }) {
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
                  {formatPlaygroundDbCell(row[col])}
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
    const tables = await listPlaygroundTables(sqlClient);
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
    const preview = await loadPlaygroundTablePreview(sqlClient, selected);
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
  const preview = await loadPlaygroundTablePreview(sqlClient, name);
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

const paneFillSx = {
  flex: 1,
  minHeight: 0,
  padding: 8,
  gap: 2,
} as const;
