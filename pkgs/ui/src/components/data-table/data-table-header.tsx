/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { For, type JSX, Show } from 'solid-js';

import { Box } from '../box';
import { Checkbox } from '../checkbox';
import { Clickable } from '../clickable';
import { Text } from '../text';
import styles from './data-table.module.css';
import { DATA_TABLE_SELECTION_COL_WIDTH } from './data-table-metrics';
import type { DataTableColumn, DataTableOrderDir } from './data-table-types';

export type DataTableSelectionHeader = {
  readonly checked: boolean;
  readonly indeterminate: boolean;
  readonly onToggle: (next: boolean) => void;
};

const ALIGN_TO_JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
} as const;

export function DataTableHeader<T>(props: {
  readonly columns: readonly DataTableColumn<T>[];
  readonly orderBy: string | null;
  readonly orderDir: DataTableOrderDir;
  readonly onToggleSort: (columnId: string) => void;
  readonly selection?: DataTableSelectionHeader | undefined;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <thead>
      <tr class={styles['headRow']}>
        <Show when={props.selection}>
          {(selection) => (
            <th
              class={`${styles['cell']} ${styles['selectionCell']}`}
              scope="col"
            >
              <Box
                sx={{
                  width: DATA_TABLE_SELECTION_COL_WIDTH,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Checkbox
                  checked={selection().checked}
                  indeterminate={selection().indeterminate}
                  onToggle={selection().onToggle}
                  aria-label={t`Select all rows on this page`}
                />
              </Box>
            </th>
          )}
        </Show>
        <For each={props.columns}>
          {(col) => (
            <HeaderCell
              column={col}
              active={props.orderBy === col.id}
              orderDir={props.orderDir}
              onToggleSort={props.onToggleSort}
            />
          )}
        </For>
      </tr>
    </thead>
  );
}

function ariaSort(
  active: boolean,
  sortable: boolean,
  orderDir: DataTableOrderDir
): 'ascending' | 'descending' | 'none' | undefined {
  if (!sortable) return undefined;
  if (!active) return 'none';
  return orderDir === 'asc' ? 'ascending' : 'descending';
}

function HeaderCell<T>(props: {
  readonly column: DataTableColumn<T>;
  readonly active: boolean;
  readonly orderDir: DataTableOrderDir;
  readonly onToggleSort: (columnId: string) => void;
}): JSX.Element {
  const sortable = () => props.column.sortable === true;
  const marker = () => {
    if (!(props.active && sortable())) return '';
    return props.orderDir === 'asc' ? ' ↑' : ' ↓';
  };
  const label = () => `${props.column.header}${marker()}`;
  const justify = () => ALIGN_TO_JUSTIFY[props.column.align ?? 'start'];
  const text = () => (
    <Text
      sx={{
        color: 'textSecondary',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 10,
      }}
      numberOfLines={1}
      label={label()}
    />
  );
  return (
    <th
      class={styles['cell']}
      scope="col"
      aria-sort={ariaSort(props.active, sortable(), props.orderDir)}
    >
      <Show
        when={sortable()}
        fallback={
          <Box
            sx={{
              minWidth: props.column.width,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: justify(),
              height: '100%',
            }}
          >
            {text()}
          </Box>
        }
      >
        <Clickable
          onClick={() => props.onToggleSort(props.column.id)}
          feedback="none"
          sx={{
            minWidth: props.column.width,
            minHeight: 40,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: justify(),
            width: '100%',
          }}
        >
          {text()}
        </Clickable>
      </Show>
    </th>
  );
}
