import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { DataTableReadyBody } from './data-table-body';
import { DataTableHeader } from './data-table-header';
import { resolveColumnLayout } from './data-table-metrics';
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
    />
  );
}

function DataTableView<T>(props: {
  readonly cache: UseDataTablePageCacheResult<T>;
  readonly columns: DataTableProps<T>['columns'];
  readonly density: NonNullable<DataTableProps<T>['density']>;
  readonly getRowId: DataTableProps<T>['getRowId'];
  readonly onRowPress: DataTableProps<T>['onRowPress'];
  readonly emptyTitle: ReactNode;
  readonly emptyBody: ReactNode | undefined;
  readonly shellSx: ReturnType<typeof dataTableShellSx>;
  readonly dataSet: { component: string };
}): ReactNode {
  const { cache, columns, density, getRowId, onRowPress } = props;
  const [frameWidth, setFrameWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setFrameWidth(e.nativeEvent.layout.width);
  }, []);
  const layout = useMemo(
    () => resolveColumnLayout(columns, frameWidth),
    [columns, frameWidth]
  );

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

  if (cache.view.status !== 'ready') {
    return (
      <DataTableStatusShell
        shellSx={props.shellSx}
        dataSet={props.dataSet}
        header={header}
        onLayout={onLayout}
      >
        <DataTableStatusContent
          view={cache.view}
          onRetry={cache.retry}
          emptyTitle={props.emptyTitle}
          emptyBody={props.emptyBody}
        />
      </DataTableStatusShell>
    );
  }

  return (
    <DataTableReadyBody
      rows={cache.view.rows}
      totalCount={cache.view.totalCount}
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
      onPrev={() => cache.setPageIndex(cache.pageIndex - 1)}
      onNext={() => cache.setPageIndex(cache.pageIndex + 1)}
      shellSx={props.shellSx}
      dataSet={props.dataSet}
      onLayout={onLayout}
    />
  );
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
