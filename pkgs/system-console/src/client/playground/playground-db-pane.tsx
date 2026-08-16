import { useTimers } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  Box,
  ErrorState,
  LoadingState,
  ScrollView,
  TabStrip,
  Text,
} from '@pkgs/ui';
import { useEffect, useRef, useState } from 'react';

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
 * Soft-polls every 500ms (and on reloadToken) so the grid stays current without
 * a manual Refresh control.
 */
export function PlaygroundDbPane(props: {
  readonly sqlClient: SqlClient;
  /** Bump to force a schema reload (e.g. after snapshot restore). */
  readonly reloadToken?: number;
}) {
  const { sqlClient, reloadToken = 0 } = props;
  const timers = useTimers();
  const [state, setState] = useState<DbState>({ status: 'loading' });
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === 'ready') {
      selectedRef.current = state.selected;
    }
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const softReload = async () => {
      try {
        const next = await fetchReadyState(sqlClient, selectedRef.current);
        if (!cancelled) {
          selectedRef.current = next.selected;
          setState(next);
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };

    setState({ status: 'loading' });
    void softReload();
    const handle = timers.setInterval(() => {
      void softReload();
    }, 500);

    return () => {
      cancelled = true;
      timers.clearInterval(handle);
    };
  }, [sqlClient, timers]);

  const reloadTokenReady = useRef(false);
  useEffect(() => {
    if (!reloadTokenReady.current) {
      reloadTokenReady.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchReadyState(sqlClient, selectedRef.current);
        if (!cancelled) {
          selectedRef.current = next.selected;
          setState(next);
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, sqlClient]);

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
      </Box>
    );
  }

  const onSelect = (name: string) => {
    selectedRef.current = name;
    void selectTable(sqlClient, name, setState);
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
      <TabStrip
        accessibilityLabel="Tables"
        items={state.tables.map((t) => ({ id: t.name, label: t.name }))}
        selectedId={state.selected}
        onSelect={onSelect}
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

async function fetchReadyState(
  sqlClient: SqlClient,
  preferredSelected: string | null
): Promise<ReadyState> {
  const tables = await listPlaygroundTables(sqlClient);
  const selected =
    preferredSelected != null &&
    tables.some((t) => t.name === preferredSelected)
      ? preferredSelected
      : (tables[0]?.name ?? null);
  if (selected == null) {
    return {
      status: 'ready',
      tables,
      selected: null,
      columns: [],
      rows: [],
      rowError: null,
    };
  }
  const preview = await loadPlaygroundTablePreview(sqlClient, selected);
  return {
    status: 'ready',
    tables,
    selected,
    columns: preview.columns,
    rows: preview.rows,
    rowError: preview.error,
  };
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
