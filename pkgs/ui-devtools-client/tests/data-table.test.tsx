/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { DataTable } from '@pkgs/ui-devtools-client/data-table';
import { createMemoryPageLoader } from '@pkgs/ui-devtools-shared/create-memory-page-loader';
import {
  pageCacheKey,
  resolveColumnLayout,
} from '@pkgs/ui-devtools-shared/data-table-metrics';
import {
  pageSelectionState,
  setPageKeysSelected,
  toggleSelectedKey,
} from '@pkgs/ui-devtools-shared/data-table-selection';
import type {
  DataTableColumn,
  DataTableLoadPage,
} from '@pkgs/ui-devtools-shared/data-table-types';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

type Row = { id: string; name: string; score: number };

const ROWS: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  score: (i * 7) % 12,
}));

const COLUMNS: DataTableColumn<Row>[] = [
  {
    id: 'name',
    header: 'Name',
    width: 120,
    sortable: true,
    getValue: (r) => r.name,
  },
  {
    id: 'score',
    header: 'Score',
    width: 80,
    align: 'end',
    sortable: true,
    getValue: (r) => r.score,
  },
  { id: 'custom', header: 'Custom', width: 60, cell: (r) => <em>{r.id}</em> },
];

const compare = (a: Row, b: Row, orderBy: string, dir: 'asc' | 'desc') => {
  const sign = dir === 'asc' ? 1 : -1;
  if (orderBy === 'score') return (a.score - b.score) * sign;
  return a.name.localeCompare(b.name) * sign;
};

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`missing item ${index}`);
  return item;
}

async function firstCellTexts(): Promise<string[]> {
  await waitFor(() => {
    expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });
  return [...document.querySelectorAll('tbody tr')].map(
    (tr) => tr.querySelector('td')?.textContent ?? ''
  );
}

describe('DataTable', () => {
  test('renders a semantic table with header, rows, and custom cells', async () => {
    const loadPage = createMemoryPageLoader(() => ROWS, compare);
    renderUi(() => (
      <DataTable
        columns={COLUMNS}
        loadPage={loadPage}
        getRowId={(r) => r.id}
        pageSize={5}
      />
    ));
    const table = await screen.findByRole('table');
    expect(table.querySelector('thead')).not.toBeNull();
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual([
      'Name',
      'Score',
      'Custom',
    ]);
    await waitFor(() => {
      expect(document.querySelectorAll('tbody tr')).toHaveLength(5);
    });
    expect(document.querySelector('tbody em')?.textContent).toBe('r0');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  test('sortable headers are buttons with aria-sort and toggle direction', async () => {
    const loadPage = createMemoryPageLoader(() => ROWS, compare);
    renderUi(() => (
      <DataTable
        columns={COLUMNS}
        loadPage={loadPage}
        getRowId={(r) => r.id}
        pageSize={12}
      />
    ));
    await firstCellTexts();
    const scoreHeader = screen.getByRole('columnheader', { name: /Score/ });
    expect(scoreHeader).toHaveAttribute('aria-sort', 'none');
    expect(
      screen.getByRole('columnheader', { name: 'Custom' })
    ).not.toHaveAttribute('aria-sort');
    fireEvent.click(screen.getByRole('button', { name: /Score/ }));
    await waitFor(() => {
      expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending');
    });
    const asc = await firstCellTexts();
    expect(asc[0]).toBe('Row 0');
    fireEvent.click(screen.getByRole('button', { name: /Score/ }));
    await waitFor(() => {
      expect(scoreHeader).toHaveAttribute('aria-sort', 'descending');
    });
    await waitFor(async () => {
      const desc = await firstCellTexts();
      expect(desc[0]).not.toBe('Row 0');
    });
  });

  test('paginates through PaginationControls and caches pages', async () => {
    const inner = createMemoryPageLoader(() => ROWS);
    const loadPage = mock<DataTableLoadPage<Row>>((p) => inner(p));
    renderUi(() => (
      <DataTable
        columns={COLUMNS}
        loadPage={loadPage}
        getRowId={(r) => r.id}
        pageSize={5}
      />
    ));
    expect((await firstCellTexts())[0]).toBe('Row 0');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });
    await waitFor(async () => {
      expect((await firstCellTexts())[0]).toBe('Row 5');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
    expect(loadPage).toHaveBeenCalledTimes(2);
  });

  test('row clicks fire onRowClick; selection checkboxes stay separate', async () => {
    const onRowClick = mock();
    const onSelectedKeysChange = mock((_keys: readonly string[]) => {});
    const [selected, setSelected] = createSignal<readonly string[]>([]);
    renderUi(() => (
      <DataTable
        columns={COLUMNS}
        loadPage={createMemoryPageLoader(() => ROWS.slice(0, 3))}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
        selectionMode="multiple"
        selectedKeys={selected()}
        onSelectedKeysChange={(keys) => {
          onSelectedKeysChange(keys);
          setSelected(keys);
        }}
      />
    ));
    await firstCellTexts();
    const rowCheckboxes = screen.getAllByRole('checkbox', {
      name: 'Select row',
    });
    expect(rowCheckboxes).toHaveLength(3);
    fireEvent.click(nth(rowCheckboxes, 1));
    expect(onSelectedKeysChange).toHaveBeenLastCalledWith(['r1']);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(document.querySelector('tr[data-row-key="r1"]')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    const selectAll = screen.getByRole('checkbox', { name: /Select all/ });
    expect(selectAll).toHaveAttribute('aria-checked', 'mixed');
    fireEvent.click(selectAll);
    expect(onSelectedKeysChange).toHaveBeenLastCalledWith(['r1', 'r0', 'r2']);

    const firstRowButton = document.querySelector(
      'tbody tr td button:not([role="checkbox"])'
    );
    if (!(firstRowButton instanceof HTMLElement))
      throw new Error('no row button');
    fireEvent.click(firstRowButton);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  test('shows empty and error states with retry', async () => {
    let fail = true;
    const loadPage: DataTableLoadPage<Row> = () =>
      fail
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ rows: [], totalCount: 0 });
    renderUi(() => (
      <DataTable
        columns={COLUMNS}
        loadPage={loadPage}
        getRowId={(r) => r.id}
        emptyTitle="Nothing here"
      />
    ));
    await screen.findByText('boom');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Retry|Try again/i }));
    await screen.findByText('Nothing here');
    expect(screen.queryByText(/Page 1 of/)).toBeNull();
  });
});

describe('data-table pure helpers', () => {
  test('resolveColumnLayout stretches proportionally and keeps minimums', () => {
    const cols = [
      { id: 'a', header: 'A', width: 100 },
      { id: 'b', header: 'B', width: 300 },
    ];
    const tight = resolveColumnLayout(cols, 0);
    expect(tight).toEqual({ tableWidth: 424, widths: [100, 300] });
    const wide = resolveColumnLayout(cols, 824);
    expect(wide.tableWidth).toBe(824);
    expect(wide.widths).toEqual([200, 600]);
    expect(resolveColumnLayout([], 50).widths).toEqual([]);
  });

  test('pageCacheKey and selection helpers', () => {
    expect(pageCacheKey(null, 'asc', 0, 50)).toBe(':asc:0:50');
    expect(setPageKeysSelected(['a'], ['b', 'a'], true)).toEqual(['a', 'b']);
    expect(setPageKeysSelected(['a', 'c'], ['a'], false)).toEqual(['c']);
    expect(toggleSelectedKey(['a'], 'a', true)).toEqual(['a']);
    expect(toggleSelectedKey(['a'], 'a', false)).toEqual([]);
    expect(pageSelectionState(['a', 'b'], ['a'])).toEqual({
      all: false,
      some: true,
    });
    expect(pageSelectionState(['a'], ['a'])).toEqual({
      all: true,
      some: false,
    });
    expect(pageSelectionState([], ['a'])).toEqual({ all: false, some: false });
  });
});
