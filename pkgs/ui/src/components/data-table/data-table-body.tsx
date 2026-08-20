import { type ReactNode, useCallback, useMemo } from 'react';
import type { LayoutChangeEvent, ListRenderItemInfo } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { FlatList } from '../flat-list';
import { ScrollView } from '../scroll-view';
import {
  DataTableHeader,
  type DataTableSelectionHeader,
} from './data-table-header';
import { DATA_TABLE_ROW_HEIGHT } from './data-table-metrics';
import { DataTablePagination } from './data-table-pagination';
import { DataTableRow } from './data-table-row';
import type {
  DataTableColumn,
  DataTableDensity,
  DataTableOrderDir,
} from './data-table-types';

type ReadyBodyProps<T> = {
  readonly rows: readonly T[];
  readonly totalCount: number;
  readonly columns: readonly DataTableColumn<T>[];
  readonly widths: readonly number[];
  readonly tableWidth: number;
  readonly density: DataTableDensity;
  readonly getRowId: (row: T, index: number) => string;
  readonly onRowPress: ((row: T) => void) | undefined;
  readonly orderBy: string | null;
  readonly orderDir: DataTableOrderDir;
  readonly onToggleSort: (columnId: string) => void;
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly onPageChange: (pageIndex: number) => void;
  readonly selectionHeader?: DataTableSelectionHeader;
  readonly selectedKeySet?: ReadonlySet<string>;
  readonly onToggleRowKey?: (key: string, selected: boolean) => void;
  readonly shellSx: SxInput;
  readonly dataSet: ComponentDataSet;
  readonly onLayout: (e: LayoutChangeEvent) => void;
};

export function DataTableReadyBody<T>(props: ReadyBodyProps<T>): ReactNode {
  const list = useDataTableList(props);
  const header = (
    <DataTableHeader
      columns={props.columns}
      widths={props.widths}
      tableWidth={props.tableWidth}
      orderBy={props.orderBy}
      orderDir={props.orderDir}
      onToggleSort={props.onToggleSort}
      {...(props.selectionHeader != null
        ? { selection: props.selectionHeader }
        : {})}
    />
  );

  return (
    <Box sx={props.shellSx} dataSet={props.dataSet} onLayout={props.onLayout}>
      <ScrollView
        horizontal
        frameSx={{ flex: 1, minHeight: 0, minWidth: 0, alignSelf: 'stretch' }}
        sx={{ minHeight: 0 }}
      >
        <FlatList
          data={props.rows as T[]}
          keyExtractor={list.keyExtractor}
          renderItem={list.renderItem}
          getItemLayout={list.getItemLayout}
          ListHeaderComponent={header}
          windowSize={7}
          maxToRenderPerBatch={10}
          initialNumToRender={20}
          removeClippedSubviews
          frameSx={{ flex: 1, minHeight: 0, width: props.tableWidth }}
          sx={{ width: props.tableWidth }}
          extraData={list.extraData}
        />
      </ScrollView>
      <DataTablePagination
        pageIndex={props.pageIndex}
        pageCount={props.pageCount}
        totalCount={props.totalCount}
        onPageChange={props.onPageChange}
      />
    </Box>
  );
}

function useDataTableList<T>(props: ReadyBodyProps<T>) {
  const {
    columns,
    widths,
    tableWidth,
    density,
    getRowId,
    onRowPress,
    selectedKeySet,
    onToggleRowKey,
  } = props;
  const rowHeight = DATA_TABLE_ROW_HEIGHT[density];
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: rowHeight,
      offset: rowHeight * index,
      index,
    }),
    [rowHeight]
  );
  const keyExtractor = useCallback(
    (item: T, index: number) => getRowId(item, index),
    [getRowId]
  );
  const selectionSig = useMemo(() => {
    if (selectedKeySet == null) return '';
    return [...selectedKeySet].join(',');
  }, [selectedKeySet]);
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => {
      const rowKey = getRowId(item, index);
      const selection =
        selectedKeySet != null && onToggleRowKey != null
          ? {
              selected: selectedKeySet.has(rowKey),
              onToggle: (next: boolean) => onToggleRowKey(rowKey, next),
            }
          : undefined;
      return (
        <DataTableRow
          row={item}
          columns={columns}
          widths={widths}
          tableWidth={tableWidth}
          density={density}
          {...(onRowPress != null ? { onPress: () => onRowPress(item) } : {})}
          {...(selection != null ? { selection } : {})}
        />
      );
    },
    [
      columns,
      widths,
      tableWidth,
      density,
      onRowPress,
      getRowId,
      selectedKeySet,
      onToggleRowKey,
    ]
  );
  const extraData = `${props.orderBy}:${props.orderDir}:${props.density}:${props.tableWidth}:${selectionSig}`;
  return { getItemLayout, keyExtractor, renderItem, extraData };
}
