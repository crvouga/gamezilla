/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
import { ChipGroup } from '../chip-group/index';
import { IconButton } from '../icon-button/index';
import { ChevronDownIcon, ChevronUpIcon } from '../icons';
import { spaced } from '../layout-classes';
import {
  nextSort,
  onRowKeyDown,
  PRESSABLE_ROW,
  rowTestId,
  type TableColumn,
  type TableSort,
} from './table-parts';
import type { TableBodyProps } from './table-wide';

function CompactFields<R>(props: {
  columns: readonly TableColumn<R>[];
  row: R;
}): JSX.Element {
  const primary = () => props.columns.find((column) => column.primary);
  const fields = () => props.columns.filter((column) => !column.primary);
  return (
    <div class="box gap-ui-sm">
      <Show when={primary()}>
        {(column) => (
          <div class="box text textBody">{column().render(props.row)}</div>
        )}
      </Show>
      <dl class="box gap-ui-xs">
        <For each={fields()}>
          {(column) => (
            <div class="box flex-row items-baseline justify-between gap-ui-md">
              <dt class="text textFootnote text-text-secondary shrink-0">
                {column.header}
              </dt>
              <dd class="text textBody text-end m-0 min-w-0">
                {column.render(props.row)}
              </dd>
            </div>
          )}
        </For>
      </dl>
    </div>
  );
}

function CompactRow<R>(props: {
  table: TableBodyProps<R>;
  row: R;
}): JSX.Element {
  const press = (): void => props.table.onRowPress?.(props.row);
  const pressable = (): boolean => props.table.onRowPress !== undefined;
  return (
    <li
      class="box border-b border-border last:border-b-0"
      data-testid={rowTestId(props.table.testId, props.table.rowKey(props.row))}
      data-component={componentId('TableRow')}
      data-pressable={pressable() ? 'true' : undefined}
    >
      <Show
        when={pressable()}
        fallback={
          <div class="box px-ui-lg py-ui-md">
            <CompactFields columns={props.table.columns} row={props.row} />
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
          <CompactFields columns={props.table.columns} row={props.row} />
        </div>
      </Show>
    </li>
  );
}

/**
 * On a phone there are no column headers to press, so a sortable table
 * offers its order as chips (one per sortable column) and a button that
 * flips the direction.
 */
function CompactSort<R>(props: {
  columns: readonly TableColumn<R>[];
  sort: TableSort | undefined;
  onSort: (sort: TableSort) => void;
}): JSX.Element {
  const { t } = useLingui();
  const sortable = () =>
    props.columns.filter((column) => column.sortValue !== undefined);
  const descending = () => props.sort?.direction === 'descending';
  return (
    <Show when={sortable().length > 0}>
      <div class="box flex-row items-center gap-ui-sm">
        <div class="box flex-1 min-w-0">
          <ChipGroup
            aria-label={t`Sort by`}
            options={sortable().map((column) => ({
              key: column.key,
              label: column.header,
            }))}
            selected={props.sort?.key ?? ''}
            onSelect={(key) => props.onSort(nextSort(undefined, key))}
          />
        </div>
        <Show when={props.sort}>
          {(sort) => (
            <IconButton
              label={descending() ? t`Sort ascending` : t`Sort descending`}
              onClick={() => props.onSort(nextSort(sort(), sort().key))}
            >
              <Show
                when={descending()}
                fallback={<ChevronUpIcon size={20} color="icon" />}
              >
                <ChevronDownIcon size={20} color="icon" />
              </Show>
            </IconButton>
          )}
        </Show>
      </div>
    </Show>
  );
}

/** A phone's table: an optional order, then one card per row in a panel. */
export function CompactTable<R>(props: {
  table: TableBodyProps<R>;
}): JSX.Element {
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
      <CompactSort
        columns={props.table.columns}
        sort={props.table.sort}
        onSort={props.table.onSort}
      />
      <ul
        class="box bg-surface rounded-card border border-border overflow-hidden"
        aria-labelledby={
          props.table.caption === undefined ? undefined : captionId
        }
        aria-label={
          props.table.caption === undefined ? props.table.label : undefined
        }
      >
        <For each={props.table.rows}>
          {(row) => <CompactRow table={props.table} row={row} />}
        </For>
      </ul>
    </div>
  );
}
