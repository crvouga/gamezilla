import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { DataTableReadyBody } from './data-table-body';
import { DataTableHeader } from './data-table-header';
import {
  DATA_TABLE_SELECTION_COL_WIDTH,
  resolveColumnLayout,
} from './data-table-metrics';
import {
  pageSelectionState,
  setPageKeysSelected,
  toggleSelectedKey,
} from './data-table-selection';
import {
  DataTableEmptyBody,
  DataTableErrorBody,
  DataTableLoadingBody,
  DataTableStatusShell,
  dataTableShellSx,
} from './data-table-status';
import type { DataTableProps } from './data-table-types';
import {
  type UseDataTablePageCacheResult,
  useDataTablePageCache,
} from './use-data-table-page-cache';

const DEFAULT_PAGE_SIZE = 50;

/**
 * `DataTable` -- loader-driven columnar table with in-memory page cache.
 *
 * Callers inject `loadPage({ offset, limit, orderBy, orderDir })`. The table
 * never takes a full row array; it caches page responses, virtualizes the
 * current page via FlatList, and exposes pagination + optional column sort.
 *
 * Declared column `width` values are minimums; leftover frame space is
 * distributed proportionally so columns always fill the table.
 *
 * For compact row actions prefer quiet IconButton (~28px), not full Button.
 * Enable bulk select with `selectionMode="multiple"` + controlled keys.
 */
export function DataTable<T>(props: DataTableProps<T>): ReactNode {
  const {
    columns,
    loadPage,
    getRowId,
    sourceKey,
    pageSize = DEFAULT_PAGE_SIZE,
    defaultOrderBy = null,
    defaultOrderDir = 'asc',
    emptyTitle = 'No results',
    emptyBody,
    onRowPress,
    density = 'comfortable',
    selectionMode = 'none',
    selectedKeys = [],
    onSelectedKeysChange,
    frameSx,
    sx,
    dataSet,
  } = props;

  const cache = useDataTablePageCache({
    loadPage,
    sourceKey,
    pageSize,
    defaultOrderBy,
    defaultOrderDir,
  });
  const shellSx = dataTableShellSx(frameSx, sx);
  const rootDataSet = { component: 'DataTable', ...dataSet };
  const selectionEnabled =
    selectionMode === 'multiple' && onSelectedKeysChange != null;

  return (
    <DataTableView
      cache={cache}
      columns={columns}
      density={density}
      getRowId={getRowId}
      onRowPress={onRowPress}
      emptyTitle={emptyTitle}
      emptyBody={emptyBody}
      shellSx={shellSx}
      dataSet={rootDataSet}
      selectionEnabled={selectionEnabled}
      selectedKeys={selectedKeys}
      onSelectedKeysChange={onSelectedKeysChange}
    />
  );
}

type DataTableViewProps<T> = {
  readonly cache: UseDataTablePageCacheResult<T>;
  readonly columns: DataTableProps<T>['columns'];
  readonly density: NonNullable<DataTableProps<T>['density']>;
  readonly getRowId: DataTableProps<T>['getRowId'];
  readonly onRowPress: DataTableProps<T>['onRowPress'];
  readonly emptyTitle: ReactNode;
  readonly emptyBody: ReactNode | undefined;
  readonly shellSx: ReturnType<typeof dataTableShellSx>;
  readonly dataSet: { component: string };
  readonly selectionEnabled: boolean;
  readonly selectedKeys: readonly string[];
  readonly onSelectedKeysChange:
    | ((keys: readonly string[]) => void)
    | undefined;
};

function DataTableView<T>(props: DataTableViewProps<T>): ReactNode {
  const layout = useDataTableLayout(props);
  if (props.cache.view.status !== 'ready') {
    return (
      <DataTableStatusShell
        shellSx={props.shellSx}
        dataSet={props.dataSet}
        header={layout.header}
        onLayout={layout.onLayout}
      >
        <DataTableStatusContent
          view={props.cache.view}
          onRetry={props.cache.retry}
          emptyTitle={props.emptyTitle}
          emptyBody={props.emptyBody}
        />
      </DataTableStatusShell>
    );
  }
  return <DataTableReadyView {...props} layout={layout} />;
}

function useDataTableLayout<T>(props: DataTableViewProps<T>) {
  const { cache, columns, selectionEnabled } = props;
  const [frameWidth, setFrameWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setFrameWidth(e.nativeEvent.layout.width);
  }, []);
  const selectionPad = selectionEnabled ? DATA_TABLE_SELECTION_COL_WIDTH : 0;
  const layout = useMemo(() => {
    const data = resolveColumnLayout(
      columns,
      Math.max(0, frameWidth - selectionPad)
    );
    return {
      widths: data.widths,
      tableWidth: data.tableWidth + selectionPad,
    };
  }, [columns, frameWidth, selectionPad]);
  const header = (
    <DataTableHeader
      columns={columns}
      widths={layout.widths}
      tableWidth={layout.tableWidth}
      orderBy={cache.orderBy}
      orderDir={cache.orderDir}
      onToggleSort={cache.toggleSort}
    />
  );
  return { ...layout, header, onLayout };
}

function DataTableReadyView<T>(
  props: DataTableViewProps<T> & {
    readonly layout: ReturnType<typeof useDataTableLayout<T>>;
  }
): ReactNode {
  const {
    cache,
    columns,
    density,
    getRowId,
    onRowPress,
    selectionEnabled,
    selectedKeys,
    onSelectedKeysChange,
    layout,
  } = props;
  const rows = cache.view.status === 'ready' ? cache.view.rows : [];
  const totalCount = cache.view.status === 'ready' ? cache.view.totalCount : 0;
  const selection = usePageSelection({
    rows,
    getRowId,
    selectionEnabled,
    selectedKeys,
    onSelectedKeysChange,
  });

  return (
    <DataTableReadyBody
      rows={rows}
      totalCount={totalCount}
      columns={columns}
      widths={layout.widths}
      tableWidth={layout.tableWidth}
      density={density}
      getRowId={getRowId}
      onRowPress={onRowPress}
      orderBy={cache.orderBy}
      orderDir={cache.orderDir}
      onToggleSort={cache.toggleSort}
      pageIndex={cache.pageIndex}
      pageCount={cache.pageCount}
      onPageChange={cache.setPageIndex}
      shellSx={props.shellSx}
      dataSet={props.dataSet}
      onLayout={layout.onLayout}
      {...selection}
    />
  );
}

function usePageSelection<T>(args: {
  readonly rows: readonly T[];
  readonly getRowId: DataTableProps<T>['getRowId'];
  readonly selectionEnabled: boolean;
  readonly selectedKeys: readonly string[];
  readonly onSelectedKeysChange:
    | ((keys: readonly string[]) => void)
    | undefined;
}) {
  const {
    rows,
    getRowId,
    selectionEnabled,
    selectedKeys,
    onSelectedKeysChange,
  } = args;
  const selectedKeySet = useMemo(
    () => (selectionEnabled ? new Set(selectedKeys) : undefined),
    [selectionEnabled, selectedKeys]
  );
  const pageKeys = useMemo(
    () => rows.map((row, index) => getRowId(row, index)),
    [rows, getRowId]
  );
  const pageSel = pageSelectionState(pageKeys, selectedKeys);
  const selectionHeader =
    selectionEnabled && onSelectedKeysChange != null
      ? {
          checked: pageSel.all,
          indeterminate: pageSel.some,
          onToggle: (next: boolean) => {
            onSelectedKeysChange(
              setPageKeysSelected(selectedKeys, pageKeys, next)
            );
          },
        }
      : undefined;
  const onToggleRowKey =
    selectionEnabled && onSelectedKeysChange != null
      ? (key: string, selected: boolean) => {
          onSelectedKeysChange(toggleSelectedKey(selectedKeys, key, selected));
        }
      : undefined;

  return {
    ...(selectionHeader != null ? { selectionHeader } : {}),
    ...(selectedKeySet != null ? { selectedKeySet } : {}),
    ...(onToggleRowKey != null ? { onToggleRowKey } : {}),
  };
}

function DataTableStatusContent<T>(props: {
  readonly view: UseDataTablePageCacheResult<T>['view'];
  readonly onRetry: () => void;
  readonly emptyTitle: ReactNode;
  readonly emptyBody: ReactNode | undefined;
}): ReactNode {
  const { view, onRetry, emptyTitle, emptyBody } = props;
  if (view.status === 'loading') return <DataTableLoadingBody />;
  if (view.status === 'error') {
    return <DataTableErrorBody message={view.message} onRetry={onRetry} />;
  }
  return <DataTableEmptyBody title={emptyTitle} body={emptyBody} />;
}
