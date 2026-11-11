/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, type JSX, Show } from 'solid-js';
import { useThemeLayout } from '../theme-context/index';
import { CompactTable } from './table-compact';
import { sortRows, type TableColumn, type TableSort } from './table-parts';
import { type TableBodyProps, WideTable } from './table-wide';

export type {
  TableAlign,
  TableColumn,
  TableSort,
  TableSortDirection,
} from './table-parts';

export type TableProps<R> = {
  columns: readonly TableColumn<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** Names the table; shown above it. */
  caption?: string | undefined;
  /**
   * Names the table for assistive tech only, when a heading beside it
   * already shows its name (as `DataTable` does). Ignored with `caption`.
   */
  label?: string | undefined;
  onRowPress?: ((row: R) => void) | undefined;
  /** Accessible name of a pressable row. */
  rowLabel?: ((row: R) => string) | undefined;
  /**
   * The order the rows first show in, by a column with a `sortValue`. A
   * person can change it from the column headers (or, on a phone, the
   * "Sort by" chips); without it the rows keep their given order until then.
   */
  defaultSort?: TableSort | undefined;
  /** Shown instead of the rows when there are none. */
  empty?: JSX.Element | undefined;
  /**
   * Rendered as `data-testid`; each row gets `<testId>-<rowKey>`, and
   * `data-pressable="true"` when it opens something.
   */
  testId?: string | undefined;
};

/**
 * `Table` -- rows of records with the same fields. On a tablet or wider it
 * is a real `<table>`: an optional `<caption>`, a header row of
 * `<th scope="col">` in quiet footnote type, hairlines between rows, rows at
 * least 44px tall. On a phone each row becomes one card of a panel list:
 * the `primary` column (the row's name) heads it, the other fields follow as
 * label / value pairs, so nothing scrolls sideways.
 *
 * - `onRowPress` makes each row pressable: a hover tint, a pointer, and a
 *   keyboard stop that Enter and Space activate. Give `rowLabel` so the row
 *   announces what it opens.
 * - A column with `sortValue` can order the rows: its header is a button
 *   (`aria-sort` says which way); pressing it again flips the direction. A
 *   phone offers the same choice as "Sort by" chips and a direction button.
 *   `defaultSort` sets the first order.
 * - `empty` replaces the rows when there are none (an `EmptyState`).
 * - Columns size to their content; `width="min"` keeps a column as narrow
 *   as its widest cell (an action, a status), `align="end"` lines up
 *   numbers.
 *
 * For a screen whose subject is the list (a toolbar, loading, failure,
 * paging), compose `DataTable`, which draws this.
 *
 * @example
 * ```tsx
 * <Table
 *   caption={t`Recent games`}
 *   rows={games()}
 *   rowKey={(game) => game.id}
 *   onRowPress={(game) => open(game.id)}
 *   rowLabel={(game) => t`Open game against ${game.opponent}`}
 *   defaultSort={{ key: 'moves', direction: 'descending' }}
 *   columns={[
 *     { key: 'opponent', header: t`Opponent`, primary: true, render: (game) => game.opponent },
 *     { key: 'result', header: t`Result`, width: 'min', render: (game) => game.result },
 *     { key: 'moves', header: t`Moves`, align: 'end', sortValue: (game) => game.moves, render: (game) => game.moves },
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
  const { i18n } = useLingui();
  const wide = (): boolean => layout.breakpoint() !== 'mobile';
  // The first order is the caller's; after that it is the reader's choice.
  const [sort, setSort] = createSignal<TableSort | undefined>(
    props.defaultSort
  );
  const body: TableBodyProps<R> = {
    get columns() {
      return props.columns;
    },
    get rows() {
      return sortRows(props.rows, props.columns, sort(), i18n().locale);
    },
    get rowKey() {
      return props.rowKey;
    },
    get caption() {
      return props.caption;
    },
    get label() {
      return props.label;
    },
    get onRowPress() {
      return props.onRowPress;
    },
    get rowLabel() {
      return props.rowLabel;
    },
    get testId() {
      return props.testId;
    },
    get sort() {
      return sort();
    },
    onSort: setSort,
  };
  return (
    <div
      class="box"
      data-testid={props.testId}
      data-component={componentId('Table')}
      data-layout={wide() ? 'wide' : 'compact'}
    >
      <Show when={props.rows.length > 0} fallback={props.empty}>
        <Show when={wide()} fallback={<CompactTable table={body} />}>
          <WideTable table={body} />
        </Show>
      </Show>
    </div>
  );
}
