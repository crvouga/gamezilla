import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  Box,
  Button,
  ErrorState,
  LoadingState,
  ScrollView,
  TabStrip,
  Text,
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
 * Live SQL browser for a playground node: TabStrip table picker + column grid.
 */
export function PlaygroundDbPane(props: {
  readonly sqlClient: SqlClient;
  /** Bump to force a schema reload (e.g. after snapshot restore). */
  readonly reloadToken?: number;
}) {
  const { sqlClient, reloadToken = 0 } = props;
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
  }, [sqlClient, tick, reloadToken]);

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

  return (
    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
      <TabStrip
        accessibilityLabel="Tables"
        items={state.tables.map((t) => ({ id: t.name, label: t.name }))}
        selectedId={state.selected}
        onSelect={onSelect}
        trailing={
          <Button
            title="Refresh"
            size="sm"
            intent="neutral"
            variant="ghost"
            onPress={onRefresh}
          />
        }
      />
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <GridPreview state={state} />
      </Box>
    </Box>
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
        {state.tables.length === 0 ? 'No tables yet.' : 'Select a table.'}
      </Text>
    );
  }
  return (
    <ScrollView
      horizontal
      frameSx={{ flex: 1, minHeight: 0, minWidth: 0 }}
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
