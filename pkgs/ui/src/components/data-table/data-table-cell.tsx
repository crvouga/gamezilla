import { memo, type ReactNode } from 'react';

import { Box } from '../box';
import { Text } from '../text';
import type { DataTableColumn, DataTableColumnAlign } from './data-table-types';

const ALIGN_TO_JUSTIFY: Record<
  DataTableColumnAlign,
  'flex-start' | 'center' | 'flex-end'
> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

export function DataTableCellContent<T>(props: {
  readonly column: DataTableColumn<T>;
  readonly row: T;
}): ReactNode {
  const { column, row } = props;
  if (column.cell != null) {
    return column.cell(row);
  }
  const value = column.getValue?.(row);
  const label = value == null ? '' : String(value);
  return (
    <Text
      sx={{ color: 'text', fontSize: 12 }}
      numberOfLines={1}
      label={label}
    />
  );
}

export const DataTableCell = memo(function DataTableCell<T>({
  column,
  row,
  width,
}: {
  readonly column: DataTableColumn<T>;
  readonly row: T;
  /** Resolved layout width (may be stretched beyond `column.width`). */
  readonly width: number;
}): ReactNode {
  const align = column.align ?? 'start';
  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        flexGrow: 0,
        justifyContent: ALIGN_TO_JUSTIFY[align],
        overflow: 'hidden',
      }}
    >
      <DataTableCellContent column={column} row={row} />
    </Box>
  );
}) as <T>(props: {
  readonly column: DataTableColumn<T>;
  readonly row: T;
  readonly width: number;
}) => ReactNode;
