/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { ChevronDownIcon, ChevronUpIcon } from '../icons';
import { spaced } from '../layout-classes';
import {
  ariaSort,
  cellClass,
  nextSort,
  onRowKeyDown,
  PRESSABLE_ROW,
  rowTestId,
  type TableColumn,
  type TableSort,
} from './table-parts';

/** What both layouts draw from: the rows already in their order. */
export type TableBodyProps<R> = {
  readonly columns: readonly TableColumn<R>[];
  readonly rows: readonly R[];
  readonly rowKey: (row: R) => string;
  readonly caption?: string | undefined;
  readonly label?: string | undefined;
  readonly onRowPress?: ((row: R) => void) | undefined;
  readonly rowLabel?: ((row: R) => string) | undefined;
  readonly testId?: string | undefined;
  readonly sort: TableSort | undefined;
  readonly onSort: (sort: TableSort) => void;
};

function WideRow<R>(props: { table: TableBodyProps<R>; row: R }): JSX.Element {
  const press = (): void => props.table.onRowPress?.(props.row);
  const pressable = (): boolean => props.table.onRowPress !== undefined;
  return (
    <tr
      class={spaced([
        'h-11 border-b border-border last:border-b-0',
        pressable() ? PRESSABLE_ROW : undefined,
      ])}
      data-testid={rowTestId(props.table.testId, props.table.rowKey(props.row))}
      data-component={componentId('TableRow')}
      data-pressable={pressable() ? 'true' : undefined}
      tabIndex={pressable() ? 0 : undefined}
      aria-label={pressable() ? props.table.rowLabel?.(props.row) : undefined}
      onClick={() => {
        if (pressable()) press();
      }}
      onKeyDown={(event) => {
        if (pressable()) onRowKeyDown(event, press);
      }}
    >
      <For each={props.table.columns}>
        {(column) => (
          <td class={cellClass(column)}>
            <span class="text textBody">{column.render(props.row)}</span>
          </td>
        )}
      </For>
    </tr>
  );
}

/** A column's header: quiet footnote type, a button when it can sort. */
function HeaderCell<R>(props: {
  table: TableBodyProps<R>;
  column: TableColumn<R>;
}): JSX.Element {
  const active = () => props.table.sort?.key === props.column.key;
  const label = (
    <span class="text textFootnote text-text-secondary">
      {props.column.header}
    </span>
  );
  return (
    <th
      class={cellClass(props.column)}
      scope="col"
      aria-sort={ariaSort(props.column, props.table.sort)}
    >
      <Show when={props.column.sortValue !== undefined} fallback={label}>
        <button
          type="button"
          class="clickable inline-flex flex-row items-center gap-ui-xs rounded-sm focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
          onClick={() =>
            props.table.onSort(nextSort(props.table.sort, props.column.key))
          }
        >
          {label}
          <Show when={active()}>
            <Show
              when={props.table.sort?.direction === 'descending'}
              fallback={<ChevronUpIcon size={16} color="icon" />}
            >
              <ChevronDownIcon size={16} color="icon" />
            </Show>
          </Show>
        </button>
      </Show>
    </th>
  );
}

/** A tablet's or desktop's table: a real `<table>` across the whole column. */
export function WideTable<R>(props: { table: TableBodyProps<R> }): JSX.Element {
  return (
    <table
      class="w-full border-collapse"
      aria-label={
        props.table.caption === undefined ? props.table.label : undefined
      }
    >
      <Show when={props.table.caption}>
        {(caption) => (
          <caption class="text-start pb-ui-sm">
            <span class="text textCaption">{caption()}</span>
          </caption>
        )}
      </Show>
      <thead>
        <tr class="border-b border-border">
          <For each={props.table.columns}>
            {(column) => <HeaderCell table={props.table} column={column} />}
          </For>
        </tr>
      </thead>
      <tbody>
        <For each={props.table.rows}>
          {(row) => <WideRow table={props.table} row={row} />}
        </For>
      </tbody>
    </table>
  );
}
