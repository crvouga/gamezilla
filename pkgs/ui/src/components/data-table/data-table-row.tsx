import { memo, type ReactNode } from 'react';

import { Box } from '../box';
import { Pressable } from '../pressable';
import { DataTableCell } from './data-table-cell';
import {
  DATA_TABLE_ROW_HEIGHT,
  DATA_TABLE_ROW_PAD_X,
} from './data-table-metrics';
import type { DataTableColumn, DataTableDensity } from './data-table-types';

export type DataTableRowProps<T> = {
  readonly row: T;
  readonly columns: readonly DataTableColumn<T>[];
  readonly widths: readonly number[];
  readonly tableWidth: number;
  readonly density: DataTableDensity;
  readonly onPress?: () => void;
};

function DataTableRowInner<T>(props: DataTableRowProps<T>): ReactNode {
  const { row, columns, widths, tableWidth, density, onPress } = props;
  const height = DATA_TABLE_ROW_HEIGHT[density];
  const content = (
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
      {columns.map((col, i) => (
        <DataTableCell
          key={col.id}
          column={col}
          row={row}
          width={widths[i] ?? col.width}
        />
      ))}
    </Box>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable onPress={onPress} sx={{ width: tableWidth }}>
      {content}
    </Pressable>
  );
}

export const DataTableRow = memo(DataTableRowInner) as <T>(
  props: DataTableRowProps<T>
) => ReactNode;
