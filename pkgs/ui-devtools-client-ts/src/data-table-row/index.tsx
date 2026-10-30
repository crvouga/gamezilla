/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import {
  DATA_TABLE_ROW_HEIGHT,
  DATA_TABLE_SELECTION_COL_WIDTH,
} from '@pkgs/ui-devtools-shared-ts/data-table-metrics';
import type {
  DataTableColumn,
  DataTableColumnAlign,
  DataTableDensity,
} from '@pkgs/ui-devtools-shared-ts/data-table-types';
import { Checkbox } from '@pkgs/ui-root-client-ts/checkbox';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { For, type JSX, Show } from 'solid-js';
import styles from '../data-table/data-table.module.css';

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
        <p class="text textFootnote line-clamp-1 text-text">
          {String(props.column.getValue?.(props.row) ?? '')}
        </p>
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
    'min-width': cssPx(props.column.width),
    'min-height': cssPx(DATA_TABLE_ROW_HEIGHT[props.density]),
    'flex-direction': 'row' as const,
    'align-items': 'center' as const,
    'justify-content': ALIGN_TO_JUSTIFY[props.column.align ?? 'start'],
    overflow: 'hidden' as const,
    width: '100%',
  });
  return (
    <td class={styles['cell']}>
      <Show
        when={props.onClick}
        fallback={
          <div class="box" style={inner()}>
            <DataTableCellContent column={props.column} row={props.row} />
          </div>
        }
      >
        {(onClick) => (
          <button
            class="clickable"
            type="button"
            style={inner()}
            onClick={() => onClick()()}
            tabIndex={props.tabbable ? 0 : -1}
          >
            <DataTableCellContent column={props.column} row={props.row} />
          </button>
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
            <div
              class="box items-center justify-center"
              style={{ width: cssPx(DATA_TABLE_SELECTION_COL_WIDTH) }}
            >
              <Checkbox
                checked={selection().selected}
                onToggle={selection().onToggle}
                aria-label={t`Select row`}
              />
            </div>
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
