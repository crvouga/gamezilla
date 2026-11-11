/** @jsxImportSource solid-js */

import type { JSX } from 'solid-js';
import { spaced } from '../layout-classes';

export type TableAlign = 'start' | 'center' | 'end';

export type TableSortDirection = 'ascending' | 'descending';

/** Which column orders the rows, and which way. */
export type TableSort = {
  readonly key: string;
  readonly direction: TableSortDirection;
};

export type TableColumn<R> = {
  /** Stable column id. */
  readonly key: string;
  readonly header: string;
  /** Default `start`. */
  readonly align?: TableAlign | undefined;
  /** `min` shrinks the column to its content. Default `auto`. */
  readonly width?: 'auto' | 'min' | undefined;
  /**
   * The column that names the row (a person with their face, a worker's
   * id). On a phone it heads the row's card, unlabeled, above the other
   * fields. At most one column is primary.
   */
  readonly primary?: boolean | undefined;
  /**
   * Makes the column sortable: the value the rows are ordered by when it
   * is chosen (text compares in the reader's order, numbers numerically).
   * Leave it out for a column whose order the server owns.
   */
  readonly sortValue?: ((row: R) => string | number) | undefined;
  readonly render: (row: R) => JSX.Element;
};

const ALIGN: Readonly<Record<TableAlign, string>> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

export const PRESSABLE_ROW =
  'cursor-pointer transition-colors hover:bg-interactive-hover active:bg-interactive-press focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:-outline-offset-2';

export function cellClass<R>(column: TableColumn<R>): string {
  return spaced([
    'px-ui-md py-ui-sm align-middle',
    ALIGN[column.align ?? 'start'],
    column.width === 'min' ? 'w-px whitespace-nowrap' : undefined,
  ]);
}

export function rowTestId(
  testId: string | undefined,
  key: string
): string | undefined {
  return testId === undefined ? undefined : `${testId}-${key}`;
}

/** Enter and Space activate a pressable row, like a button. */
export function onRowKeyDown(event: KeyboardEvent, press: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target !== event.currentTarget) return;
  event.preventDefault();
  press();
}

/** The order after choosing `key`: the same column flips, another starts ascending. */
export function nextSort(
  current: TableSort | undefined,
  key: string
): TableSort {
  if (current?.key !== key) return { key, direction: 'ascending' };
  return {
    key,
    direction: current.direction === 'ascending' ? 'descending' : 'ascending',
  };
}

function compareValues(
  collator: Intl.Collator,
  a: string | number,
  b: string | number
): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * The rows in the chosen column's order (text in the reader's `locale`);
 * ties keep their given order. Rows stay as given without a sort or when
 * the column cannot sort.
 */
export function sortRows<R>(
  rows: readonly R[],
  columns: readonly TableColumn<R>[],
  sort: TableSort | undefined,
  locale: string
): readonly R[] {
  const value = columns.find((column) => column.key === sort?.key)?.sortValue;
  if (sort === undefined || value === undefined) return rows;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: 'base',
  });
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        sign * compareValues(collator, value(a.row), value(b.row)) ||
        a.index - b.index
    )
    .map((entry) => entry.row);
}

/** `aria-sort` for a column header. */
export function ariaSort<R>(
  column: TableColumn<R>,
  sort: TableSort | undefined
): 'ascending' | 'descending' | 'none' | undefined {
  if (column.sortValue === undefined) return undefined;
  return sort?.key === column.key ? sort.direction : 'none';
}
