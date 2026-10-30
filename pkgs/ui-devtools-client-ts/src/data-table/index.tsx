/** @jsxImportSource solid-js */
/**
 * `DataTable` -- loader-driven columnar table with in-memory page cache.
 *
 * Callers inject `loadPage({ offset, limit, orderBy, orderDir })`. The table
 * never takes a full row array; it caches page responses, renders the current
 * page as a semantic `<table>`, and exposes pagination + optional column sort
 * (`<th aria-sort>` buttons).
 *
 * Declared column `width` values are minimums; the browser distributes
 * leftover width so columns always fill the table (horizontal scroll when the
 * frame is narrower than the sum of minimums).
 *
 * For compact row actions prefer quiet IconButton (~28px), not full Button.
 * Enable bulk select with `selectionMode="multiple"` + controlled keys.
 */
import { useLingui } from '@lingui/solid/macro';
import {
  pageSelectionState,
  setPageKeysSelected,
  toggleSelectedKey,
} from '@pkgs/ui-devtools-shared-ts/data-table-selection';
import type { DataTableProps } from '@pkgs/ui-devtools-shared-ts/data-table-types';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { createDataTablePageCache } from '../create-data-table-page-cache';
import type { DataTableSelectionHeader } from '../data-table-header/index';
import { DataTableHeader } from '../data-table-header/index';
import { DataTablePagination } from '../data-table-pagination/index';
import { DataTableRow } from '../data-table-row/index';
import {
  DATA_TABLE_SHELL_CLASS,
  DataTableStatusBody,
} from '../data-table-status/index';
import styles from './data-table.module.css';

const DEFAULT_PAGE_SIZE = 50;

type PageSelection = {
  readonly header: DataTableSelectionHeader | undefined;
  readonly isSelected: (key: string) => boolean;
  readonly toggleRow: ((key: string, selected: boolean) => void) | undefined;
};

function createPageSelection<T>(
  props: DataTableProps<T>,
  rows: () => readonly T[]
): () => PageSelection {
  const enabled = () =>
    props.selectionMode === 'multiple' && props.onSelectedKeysChange != null;
  const selectedKeys = () => props.selectedKeys ?? [];
  const pageKeys = createMemo(() =>
    rows().map((row, index) => props.getRowId(row, index))
  );
  const selectedSet = createMemo(() => new Set(selectedKeys()));
  return createMemo<PageSelection>(() => {
    const emit = props.onSelectedKeysChange;
    if (!enabled() || emit == null) {
      return {
        header: undefined,
        isSelected: () => false,
        toggleRow: undefined,
      };
    }
    const state = pageSelectionState(pageKeys(), selectedKeys());
    return {
      header: {
        checked: state.all,
        indeterminate: state.some,
        onToggle: (next) =>
          emit(setPageKeysSelected(selectedKeys(), pageKeys(), next)),
      },
      isSelected: (key) => selectedSet().has(key),
      toggleRow: (key, selected) =>
        emit(toggleSelectedKey(selectedKeys(), key, selected)),
    };
  });
}

export function DataTable<T>(props: DataTableProps<T>): JSX.Element {
  const { t } = useLingui();
  const cache = createDataTablePageCache<T>({
    loadPage: () => props.loadPage,
    sourceKey: () => props.sourceKey,
    pageSize: () => props.pageSize ?? DEFAULT_PAGE_SIZE,
    defaultOrderBy: () => props.defaultOrderBy ?? null,
    defaultOrderDir: () => props.defaultOrderDir ?? 'asc',
  });
  const density = () => props.density ?? 'comfortable';
  const rows = createMemo(() => {
    const view = cache.view();
    return view.status === 'ready' ? view.rows : [];
  });
  const totalCount = () => {
    const view = cache.view();
    return view.status === 'ready' ? view.totalCount : 0;
  };
  const selection = createPageSelection(props, rows);

  return (
    <div
      class={`box ${DATA_TABLE_SHELL_CLASS}${props.class ? ` ${props.class}` : ''}`}
      style={props.style}
      {...dataAttrs({ component: 'DataTable', ...props.dataSet })}
    >
      <div class={styles['scroller']}>
        <table class={styles['table']}>
          <DataTableHeader
            columns={props.columns}
            orderBy={cache.orderBy()}
            orderDir={cache.orderDir()}
            onToggleSort={cache.toggleSort}
            selection={selection().header}
          />
          <Show when={cache.view().status === 'ready'}>
            <tbody>
              <For each={rows()}>
                {(row, index) => {
                  const key = () => props.getRowId(row, index());
                  const toggleRow = () => selection().toggleRow;
                  return (
                    <DataTableRow
                      row={row}
                      rowKey={key()}
                      columns={props.columns}
                      density={density()}
                      onClick={
                        props.onRowClick
                          ? () => props.onRowClick?.(row)
                          : undefined
                      }
                      selection={
                        toggleRow()
                          ? {
                              selected: selection().isSelected(key()),
                              onToggle: (next) => toggleRow()?.(key(), next),
                            }
                          : undefined
                      }
                    />
                  );
                }}
              </For>
            </tbody>
          </Show>
        </table>
        <Show when={cache.view().status !== 'ready'}>
          <DataTableStatusBody
            view={cache.view()}
            onRetry={cache.retry}
            emptyTitle={props.emptyTitle ?? t`No results`}
            emptyBody={props.emptyBody}
          />
        </Show>
      </div>
      <DataTablePagination
        pageIndex={cache.pageIndex()}
        pageCount={cache.pageCount()}
        totalCount={totalCount()}
        onPageChange={cache.setPageIndex}
      />
    </div>
  );
}
