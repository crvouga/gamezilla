/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
import { spaced } from '../layout-classes';
import { useThemeLayout } from '../theme-context/index';

export type TableAlign = 'start' | 'center' | 'end';

export type TableColumn<R> = {
  /** Stable column id. */
  readonly key: string;
  readonly header: string;
  /** Default `start`. */
  readonly align?: TableAlign | undefined;
  /** `min` shrinks the column to its content. Default `auto`. */
  readonly width?: 'auto' | 'min' | undefined;
  readonly render: (row: R) => JSX.Element;
};

export type TableProps<R> = {
  columns: readonly TableColumn<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** Names the table; shown above it. */
  caption?: string | undefined;
  onRowPress?: ((row: R) => void) | undefined;
  /** Accessible name of a pressable row. */
  rowLabel?: ((row: R) => string) | undefined;
  /** Shown instead of the rows when there are none. */
  empty?: JSX.Element | undefined;
  /** Rendered as `data-testid`; each row gets `<testId>-<rowKey>`. */
  testId?: string | undefined;
};

const ALIGN: Readonly<Record<TableAlign, string>> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

const PRESSABLE_ROW =
  'cursor-pointer transition-colors hover:bg-interactive-hover active:bg-interactive-press focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:-outline-offset-2';

function cellClass<R>(column: TableColumn<R>): string {
  return spaced([
    'px-ui-md py-ui-sm align-middle',
    ALIGN[column.align ?? 'start'],
    column.width === 'min' ? 'w-px whitespace-nowrap' : undefined,
  ]);
}

function rowTestId(
  testId: string | undefined,
  key: string
): string | undefined {
  return testId === undefined ? undefined : `${testId}-${key}`;
}

/** Enter and Space activate a pressable row, like a button. */
function onRowKeyDown(event: KeyboardEvent, press: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target !== event.currentTarget) return;
  event.preventDefault();
  press();
}

function WideRow<R>(props: { table: TableProps<R>; row: R }): JSX.Element {
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

function WideTable<R>(props: { table: TableProps<R> }): JSX.Element {
  return (
    <table class="w-full border-collapse">
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
            {(column) => (
              <th class={cellClass(column)} scope="col">
                <span class="text textFootnote text-text-secondary">
                  {column.header}
                </span>
              </th>
            )}
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

function CompactFields<R>(props: {
  table: TableProps<R>;
  row: R;
}): JSX.Element {
  return (
    <dl class="box gap-ui-xs">
      <For each={props.table.columns}>
        {(column) => (
          <div class="box flex-row items-baseline justify-between gap-ui-md">
            <dt class="text textFootnote text-text-secondary">
              {column.header}
            </dt>
            <dd class="text textBody text-end m-0">
              {column.render(props.row)}
            </dd>
          </div>
        )}
      </For>
    </dl>
  );
}

function CompactRow<R>(props: { table: TableProps<R>; row: R }): JSX.Element {
  const press = (): void => props.table.onRowPress?.(props.row);
  return (
    <li
      class="box border-b border-border last:border-b-0"
      data-testid={rowTestId(props.table.testId, props.table.rowKey(props.row))}
      data-component={componentId('TableRow')}
    >
      <Show
        when={props.table.onRowPress !== undefined}
        fallback={
          <div class="box px-ui-lg py-ui-md">
            <CompactFields table={props.table} row={props.row} />
          </div>
        }
      >
        <div
          class={spaced(['box px-ui-lg py-ui-md min-h-11', PRESSABLE_ROW])}
          role="button"
          tabIndex={0}
          aria-label={props.table.rowLabel?.(props.row)}
          onClick={press}
          onKeyDown={(event) => onRowKeyDown(event, press)}
        >
          <CompactFields table={props.table} row={props.row} />
        </div>
      </Show>
    </li>
  );
}

function CompactTable<R>(props: { table: TableProps<R> }): JSX.Element {
  const captionId = `table-caption-${createUniqueId()}`;
  return (
    <div class="box gap-ui-sm">
      <Show when={props.table.caption}>
        {(caption) => (
          <p class="text textCaption" id={captionId}>
            {caption()}
          </p>
        )}
      </Show>
      <ul
        class="box bg-surface rounded-card border border-border overflow-hidden"
        aria-labelledby={
          props.table.caption === undefined ? undefined : captionId
        }
      >
        <For each={props.table.rows}>
          {(row) => <CompactRow table={props.table} row={row} />}
        </For>
      </ul>
    </div>
  );
}

/**
 * `Table` -- rows of records with the same fields. On a tablet or wider it
 * is a real `<table>`: an optional `<caption>`, a header row of
 * `<th scope="col">` in quiet footnote type, hairlines between rows, rows at
 * least 44px tall. On a phone each row becomes one item of a panel list,
 * its fields stacked as label / value pairs, so nothing scrolls sideways.
 *
 * - `onRowPress` makes each row pressable: a hover tint, a pointer, and a
 *   keyboard stop that Enter and Space activate. Give `rowLabel` so the row
 *   announces what it opens.
 * - `empty` replaces the rows when there are none (an `EmptyState`).
 * - Columns size to their content; `width="min"` keeps a column as narrow
 *   as its widest cell (an action, a status), `align="end"` lines up
 *   numbers.
 *
 * @example
 * ```tsx
 * <Table
 *   caption={t`Recent games`}
 *   rows={games()}
 *   rowKey={(game) => game.id}
 *   onRowPress={(game) => open(game.id)}
 *   rowLabel={(game) => t`Open game against ${game.opponent}`}
 *   columns={[
 *     { key: 'opponent', header: t`Opponent`, render: (game) => game.opponent },
 *     { key: 'result', header: t`Result`, width: 'min', render: (game) => game.result },
 *     { key: 'moves', header: t`Moves`, align: 'end', render: (game) => game.moves },
 *   ]}
 *   empty={
 *     <EmptyState
 *       variant="compact"
 *       title={t`No games yet`}
 *       body={t`Games you finish show up here.`}
 *     />
 *   }
 * />
 * ```
 */
export function Table<R>(props: TableProps<R>): JSX.Element {
  const layout = useThemeLayout();
  const wide = (): boolean => layout.breakpoint() !== 'mobile';
  return (
    <div
      class="box"
      data-testid={props.testId}
      data-component={componentId('Table')}
      data-layout={wide() ? 'wide' : 'compact'}
    >
      <Show when={props.rows.length > 0} fallback={props.empty}>
        <Show when={wide()} fallback={<CompactTable table={props} />}>
          <WideTable table={props} />
        </Show>
      </Show>
    </div>
  );
}
