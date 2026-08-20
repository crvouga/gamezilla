import type { ReactNode } from 'react';

import { Box } from '../box';
import { Checkbox } from '../checkbox';
import { Pressable } from '../pressable';
import { Text } from '../text';
import {
  DATA_TABLE_HEADER_HEIGHT,
  DATA_TABLE_ROW_PAD_X,
  DATA_TABLE_SELECTION_COL_WIDTH,
} from './data-table-metrics';
import type { DataTableColumn, DataTableOrderDir } from './data-table-types';

export type DataTableSelectionHeader = {
  readonly checked: boolean;
  readonly indeterminate: boolean;
  readonly onToggle: (next: boolean) => void;
};

export function DataTableHeader<T>(props: {
  readonly columns: readonly DataTableColumn<T>[];
  readonly widths: readonly number[];
  readonly tableWidth: number;
  readonly orderBy: string | null;
  readonly orderDir: DataTableOrderDir;
  readonly onToggleSort: (columnId: string) => void;
  readonly selection?: DataTableSelectionHeader;
}): ReactNode {
  const {
    columns,
    widths,
    tableWidth,
    orderBy,
    orderDir,
    onToggleSort,
    selection,
  } = props;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        width: tableWidth,
        height: DATA_TABLE_HEADER_HEIGHT,
        paddingHorizontal: DATA_TABLE_ROW_PAD_X,
        backgroundColor: 'surfaceMuted',
        borderBottomWidth: 1,
        borderColor: 'border',
      }}
    >
      {selection != null ? (
        <Box
          sx={{
            width: DATA_TABLE_SELECTION_COL_WIDTH,
            flexShrink: 0,
            flexGrow: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Checkbox
            checked={selection.checked}
            indeterminate={selection.indeterminate}
            onToggle={selection.onToggle}
          />
        </Box>
      ) : null}
      {columns.map((col, i) => (
        <HeaderCell
          key={col.id}
          column={col}
          width={widths[i] ?? col.width}
          active={orderBy === col.id}
          orderDir={orderDir}
          onToggleSort={onToggleSort}
        />
      ))}
    </Box>
  );
}

function HeaderCell<T>(props: {
  readonly column: DataTableColumn<T>;
  readonly width: number;
  readonly active: boolean;
  readonly orderDir: DataTableOrderDir;
  readonly onToggleSort: (columnId: string) => void;
}): ReactNode {
  const { column, width, active, orderDir, onToggleSort } = props;
  const marker =
    active && column.sortable === true
      ? orderDir === 'asc'
        ? ' ↑'
        : ' ↓'
      : '';
  const label = `${column.header}${marker}`;

  const text = (
    <Text
      sx={{
        color: 'textSecondary',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 10,
      }}
      numberOfLines={1}
      label={label}
    />
  );

  if (column.sortable !== true) {
    return (
      <Box
        sx={{
          width,
          flexShrink: 0,
          flexGrow: 0,
          justifyContent: 'center',
        }}
      >
        {text}
      </Box>
    );
  }

  return (
    <Pressable
      onPress={() => onToggleSort(column.id)}
      sx={{
        width,
        flexShrink: 0,
        flexGrow: 0,
        justifyContent: 'center',
        height: '100%',
      }}
    >
      {text}
    </Pressable>
  );
}
