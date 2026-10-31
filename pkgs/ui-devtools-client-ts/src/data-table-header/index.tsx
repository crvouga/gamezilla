/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { DATA_TABLE_SELECTION_COL_WIDTH } from '@pkgs/ui-devtools-shared-ts/data-table-metrics';
import type {
  DataTableColumn,
  DataTableOrderDir,
} from '@pkgs/ui-devtools-shared-ts/data-table-types';
import { Checkbox } from '@pkgs/ui-root-client-ts/checkbox';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { For, type JSX, Show } from 'solid-js';
import styles from '../data-table/data-table.module.css';

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

/**
 * Table headings with sortable column buttons and optional select-all checkbox. Supply the same columns and order as DataTable; selection includes the indeterminate state.
 */
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
              <div
                class="box items-center justify-center"
                style={{ width: cssPx(DATA_TABLE_SELECTION_COL_WIDTH) }}
              >
                <Checkbox
                  checked={selection().checked}
                  indeterminate={selection().indeterminate}
                  onToggle={selection().onToggle}
                  aria-label={t`Select all rows on this page`}
                />
              </div>
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
  const text = () => <p class="text textFootnote line-clamp-1">{label()}</p>;
  return (
    <th
      class={styles['cell']}
      scope="col"
      aria-sort={ariaSort(props.active, sortable(), props.orderDir)}
    >
      <Show
        when={sortable()}
        fallback={
          <div
            class="box flex-row items-center h-full"
            style={{
              'min-width': cssPx(props.column.width),
              'justify-content': justify(),
            }}
          >
            {text()}
          </div>
        }
      >
        <button
          class="clickable min-h-10 flex-row items-center w-full"
          type="button"
          style={{
            'min-width': cssPx(props.column.width),
            'justify-content': justify(),
          }}
          onClick={() => props.onToggleSort(props.column.id)}
        >
          {text()}
        </button>
      </Show>
    </th>
  );
}
