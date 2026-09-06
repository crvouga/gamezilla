/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { For, type JSX, Show } from 'solid-js';

import { Box } from '../box';
import { Checkbox } from '../checkbox';
import { Clickable } from '../clickable';
import { Text } from '../text';
import styles from './data-table.module.css';
import {
  DATA_TABLE_ROW_HEIGHT,
  DATA_TABLE_SELECTION_COL_WIDTH,
} from './data-table-metrics';
import type {
  DataTableColumn,
  DataTableColumnAlign,
  DataTableDensity,
} from './data-table-types';

export type DataTableRowSelection = {
  readonly selected: boolean;
  readonly onToggle: (next: boolean) => void;
};

export type DataTableRowProps<T> = {
  readonly row: T;
  readonly rowKey: string;
  readonly columns: readonly DataTableColumn<T>[];
  readonly density: DataTableDensity;
  readonly onClick?: (() => void) | undefined;
  readonly selection?: DataTableRowSelection | undefined;
};

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
}): JSX.Element {
  return (
    <Show
      when={props.column.cell}
      fallback={
        <Text
          sx={{ color: 'text', fontSize: 12 }}
          numberOfLines={1}
          label={String(props.column.getValue?.(props.row) ?? '')}
        />
      }
    >
      {(cell) => cell()(props.row)}
    </Show>
  );
}

function DataTableCell<T>(props: {
  readonly column: DataTableColumn<T>;
  readonly row: T;
  readonly density: DataTableDensity;
  readonly onClick: (() => void) | undefined;
  /** Only the first data cell of a clickable row joins the tab order. */
  readonly tabbable: boolean;
}): JSX.Element {
  const inner = () => ({
    minWidth: props.column.width,
    minHeight: DATA_TABLE_ROW_HEIGHT[props.density],
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: ALIGN_TO_JUSTIFY[props.column.align ?? 'start'],
    overflow: 'hidden' as const,
    width: '100%',
  });
  return (
    <td class={styles['cell']}>
      <Show
        when={props.onClick}
        fallback={
          <Box sx={inner()}>
            <DataTableCellContent column={props.column} row={props.row} />
          </Box>
        }
      >
        {(onClick) => (
          <Clickable
            onClick={() => onClick()()}
            feedback="none"
            tabIndex={props.tabbable ? 0 : -1}
            sx={inner()}
          >
            <DataTableCellContent column={props.column} row={props.row} />
          </Clickable>
        )}
      </Show>
    </td>
  );
}

/**
 * One `<tr>`. When `onClick` is set, every data cell hosts a `Clickable`
 * (so keyboard users can reach the row) while the selection checkbox stays
 * outside the click target: toggling selection never fires `onClick`.
 */
export function DataTableRow<T>(props: DataTableRowProps<T>): JSX.Element {
  const { t } = useLingui();
  return (
    <tr
      class={`${styles['bodyRow']} ${styles[props.density]}`}
      data-row-key={props.rowKey}
      aria-selected={props.selection ? props.selection.selected : undefined}
    >
      <Show when={props.selection}>
        {(selection) => (
          <td class={`${styles['cell']} ${styles['selectionCell']}`}>
            <Box
              sx={{
                width: DATA_TABLE_SELECTION_COL_WIDTH,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Checkbox
                checked={selection().selected}
                onToggle={selection().onToggle}
                aria-label={t`Select row`}
              />
            </Box>
          </td>
        )}
      </Show>
      <For each={props.columns}>
        {(col, index) => (
          <DataTableCell
            column={col}
            row={props.row}
            density={props.density}
            onClick={props.onClick}
            tabbable={index() === 0}
          />
        )}
      </For>
    </tr>
  );
}
