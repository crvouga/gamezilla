import { memo, type ReactNode } from 'react';

import { Box } from '../box';
import { Checkbox } from '../checkbox';
import { Pressable } from '../pressable';
import { DataTableCell } from './data-table-cell';
import {
  DATA_TABLE_ROW_HEIGHT,
  DATA_TABLE_ROW_PAD_X,
  DATA_TABLE_SELECTION_COL_WIDTH,
} from './data-table-metrics';
import type { DataTableColumn, DataTableDensity } from './data-table-types';

export type DataTableRowSelection = {
  readonly selected: boolean;
  readonly onToggle: (next: boolean) => void;
};

export type DataTableRowProps<T> = {
  readonly row: T;
  readonly columns: readonly DataTableColumn<T>[];
  readonly widths: readonly number[];
  readonly tableWidth: number;
  readonly density: DataTableDensity;
  readonly onPress?: () => void;
  readonly selection?: DataTableRowSelection;
};

function DataTableRowInner<T>(props: DataTableRowProps<T>): ReactNode {
  const { row, columns, widths, tableWidth, density, onPress, selection } =
    props;
  const height = DATA_TABLE_ROW_HEIGHT[density];
  const selectionCell =
    selection != null ? (
      <Box
        sx={{
          width: DATA_TABLE_SELECTION_COL_WIDTH,
          flexShrink: 0,
          flexGrow: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Checkbox checked={selection.selected} onToggle={selection.onToggle} />
      </Box>
    ) : null;

  const dataCells = columns.map((col, i) => (
    <DataTableCell
      key={col.id}
      column={col}
      row={row}
      width={widths[i] ?? col.width}
    />
  ));

  if (onPress == null) {
    return (
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          width: tableWidth,
          height,
          paddingHorizontal: DATA_TABLE_ROW_PAD_X,
          gap: 0,
          borderBottomWidth: 'hairline',
          borderColor: 'border',
        }}
      >
        {selectionCell}
        {dataCells}
      </Box>
    );
  }

  // Selection checkbox stays outside the row press target so toggling
  // selection never navigates / fires onRowPress.
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        width: tableWidth,
        height,
        paddingHorizontal: DATA_TABLE_ROW_PAD_X,
        gap: 0,
        borderBottomWidth: 'hairline',
        borderColor: 'border',
      }}
    >
      {selectionCell}
      <Pressable
        onPress={onPress}
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          height: '100%',
        }}
      >
        {dataCells}
      </Pressable>
    </Box>
  );
}

export const DataTableRow = memo(DataTableRowInner) as <T>(
  props: DataTableRowProps<T>
) => ReactNode;
