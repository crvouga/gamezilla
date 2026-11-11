/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { asLocalized } from '@pkgs/i18n-shared-ts/localized-string';
import {
  DataTable,
  type DataTableProps,
} from '@pkgs/ui-root-client-ts/data-table';
import { screen, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

type Worker = { id: string; active: number };

const WORKERS: readonly Worker[] = [
  { id: 'worker-a', active: 3 },
  { id: 'worker-b', active: 7 },
];

function table(
  overrides: Partial<DataTableProps<Worker, 'all' | 'busy'>> = {}
): DataTableProps<Worker, 'all' | 'busy'> {
  return {
    caption: 'Workers',
    count: '2 workers',
    columns: [
      { key: 'id', header: 'Worker', primary: true, render: (w) => w.id },
      {
        key: 'active',
        header: 'Active',
        align: 'end',
        sortValue: (w) => w.active,
        render: (w) => String(w.active),
      },
    ],
    rows: WORKERS,
    rowKey: (w) => w.id,
    loading: false,
    loadingLabel: 'Reading workers…',
    empty: { title: 'No workers', body: 'Workers appear once they report.' },
    testId: 'workers',
    ...overrides,
  };
}

describe('DataTable', () => {
  test('ready: a named region with its count, facts and rows', () => {
    renderUi(() => (
      <DataTable
        {...table({
          facts: [{ label: 'Admission limit', value: '12', testId: 'limit' }],
        })}
      />
    ));
    const region = screen.getByRole('region', { name: 'Workers' });
    expect(within(region).getByText('2 workers')).toBeTruthy();
    expect(screen.getByTestId('limit').textContent).toContain('12');
    const grid = within(region).getByRole('table', { name: 'Workers' });
    expect(within(grid).getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByRole('status', { name: 'Updating…' })).toBeNull();
  });

  test('loading without rows shows the loading state alone', () => {
    renderUi(() => (
      <DataTable {...table({ rows: undefined, loading: true })} />
    ));
    expect(screen.getByText('Reading workers…')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('refreshing keeps the rows and says it is updating', () => {
    renderUi(() => <DataTable {...table({ loading: true })} />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByLabelText('Updating…').length).toBeGreaterThan(0);
    expect(screen.queryByText('Reading workers…')).toBeNull();
  });

  test('failed: replaces missing rows, or sits above the last rows, with a retry', async () => {
    const user = userEvent.setup();
    const retry = mock(() => undefined);
    const failure = {
      title: 'Workers could not be loaded.',
      body: 'Check your connection and try again.',
      onRetry: retry,
    };
    const [rows, setRows] = createSignal<readonly Worker[] | undefined>();
    renderUi(() => <DataTable {...table({ rows: rows(), failure })} />);
    expect(screen.queryByRole('table')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
    setRows(WORKERS);
    expect(screen.getByText('Workers could not be loaded.')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  test('empty: the empty state says what will fill it', () => {
    renderUi(() => <DataTable {...table({ rows: [] })} />);
    expect(screen.getByText('No workers')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('toolbar: search, filter and actions report what the person did', async () => {
    const user = userEvent.setup();
    const typed = mock((_value: string) => undefined);
    const chosen = mock((_key: string) => undefined);
    const pressed = mock(() => undefined);
    renderUi(() => (
      <DataTable
        {...table({
          search: {
            value: '',
            onChange: typed,
            label: asLocalized('Find workers'),
            testId: 'workers-search',
          },
          filter: {
            label: 'Show workers',
            options: [
              { key: 'all', label: 'All' },
              { key: 'busy', label: 'Busy', testId: 'workers-busy' },
            ],
            selected: 'all',
            onSelect: chosen,
          },
          actions: [
            { label: 'Drain every worker', onPress: pressed, testId: 'drain' },
          ],
        })}
      />
    ));
    await user.type(screen.getByLabelText('Find workers'), 'b');
    expect(typed).toHaveBeenCalledWith('b');
    await user.click(screen.getByTestId('workers-busy'));
    expect(chosen).toHaveBeenCalledWith('busy');
    await user.click(
      screen.getByRole('button', { name: 'Drain every worker' })
    );
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  test('paging: Previous and Next follow what the caller can do', async () => {
    const user = userEvent.setup();
    const next = mock(() => undefined);
    renderUi(() => (
      <DataTable {...table({ paging: { label: 'Page 1', onNext: next } })} />
    ));
    const pages = screen.getByRole('navigation', { name: 'Pages' });
    expect(within(pages).getByText('Page 1')).toBeTruthy();
    expect(
      within(pages).getByRole('button', { name: 'Previous' })
    ).toBeDisabled();
    await user.click(within(pages).getByRole('button', { name: 'Next' }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('phone: rows become cards headed by the primary column', () => {
    renderUi(() => <DataTable {...table()} />, { width: 390 });
    expect(screen.queryByRole('table')).toBeNull();
    const list = screen.getByRole('list', { name: 'Workers' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });
});
