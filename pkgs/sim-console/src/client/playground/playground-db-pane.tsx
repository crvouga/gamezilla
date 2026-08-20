import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  Box,
  DataTable,
  type DataTableColumn,
  type DataTableLoadPage,
  ErrorState,
  LoadingState,
  TabStrip,
  Text,
} from '@pkgs/ui';
import { useCallback, useMemo } from 'react';

import {
  formatPlaygroundDbCell,
  loadPlaygroundTablePage,
} from './playground-db-query';
import { usePlaygroundDbSchema } from './use-playground-db-schema';

/**
 * Live SQL browser for a playground node: TabStrip table picker + DataTable
 * grid. Soft-polls schema (table list); row pages load via DataTable.loadPage.
 */
export function PlaygroundDbPane(props: {
  readonly sqlClient: SqlClient;
  /** Bump to force a schema reload (e.g. after snapshot restore). */
  readonly reloadToken?: number;
}) {
  const { sqlClient, reloadToken = 0 } = props;
  const { state, selectTable } = usePlaygroundDbSchema({
    sqlClient,
    reloadToken,
  });

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

  return (
    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
      <TabStrip
        accessibilityLabel="Tables"
        items={state.tables.map((t) => ({ id: t.name, label: t.name }))}
        selectedId={state.selected}
        onSelect={selectTable}
      />
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <GridPreview
          sqlClient={sqlClient}
          selected={state.selected}
          columns={state.columns}
          tableCount={state.tables.length}
          reloadToken={reloadToken}
        />
      </Box>
    </Box>
  );
}

function GridPreview(props: {
  readonly sqlClient: SqlClient;
  readonly selected: string | null;
  readonly columns: readonly string[];
  readonly tableCount: number;
  readonly reloadToken: number;
}) {
  const { sqlClient, selected, columns, tableCount, reloadToken } = props;
  const columnKey = columns.join('\0');
  const tableColumns = useMemo(
    () => buildDbColumns(columnKey.length === 0 ? [] : columnKey.split('\0')),
    [columnKey]
  );

  const loadPage: DataTableLoadPage<Record<string, unknown>> = useCallback(
    async (params) => {
      if (selected == null) return { rows: [], totalCount: 0 };
      return loadPlaygroundTablePage(sqlClient, selected, params);
    },
    [sqlClient, selected]
  );

  if (selected == null) {
    return (
      <Text sx={{ color: 'textSecondary', fontSize: 12, padding: 8 }}>
        {tableCount === 0 ? 'No tables yet.' : 'Select a table.'}
      </Text>
    );
  }

  if (columns.length === 0) {
    return (
      <Text sx={{ color: 'textSecondary', fontSize: 12, padding: 8 }}>
        Empty table.
      </Text>
    );
  }

  return (
    <DataTable
      columns={tableColumns}
      loadPage={loadPage}
      getRowId={(_row, index) => `${selected}-${index}`}
      sourceKey={`${selected}:${reloadToken}:${columnKey}`}
      pageSize={50}
      emptyTitle="Empty table"
      density="compact"
      frameSx={{ borderWidth: 0, borderRadius: 'none' }}
    />
  );
}

function buildDbColumns(
  columns: readonly string[]
): DataTableColumn<Record<string, unknown>>[] {
  return columns.map((col) => ({
    id: col,
    header: col,
    width: 120,
    sortable: true,
    getValue: (row) => formatPlaygroundDbCell(row[col]),
  }));
}

const paneFillSx = {
  flex: 1,
  minHeight: 0,
  padding: 8,
  gap: 2,
} as const;
