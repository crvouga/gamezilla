/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { Table } from '@pkgs/ui-root-client-ts/table';
import { screen, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { mustQuery, renderUi } from './render';

type Game = { id: string; opponent: string; moves: number };

const GAMES: readonly Game[] = [
  { id: 'g1', opponent: 'Ada', moves: 34 },
  { id: 'g2', opponent: 'Grace', moves: 51 },
];

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`no item ${index}`);
  return item;
}

const COLUMNS: readonly TableColumn<Game>[] = [
  { key: 'opponent', header: 'Opponent', render: (g) => g.opponent },
  {
    key: 'moves',
    header: 'Moves',
    align: 'end',
    width: 'min',
    render: (g) => String(g.moves),
  },
];

describe('Table', () => {
  test('wide: a captioned table with column headers and one row per record', () => {
    renderUi(() => (
      <Table
        caption="Recent games"
        columns={COLUMNS}
        rows={GAMES}
        rowKey={(g) => g.id}
        testId="games"
      />
    ));
    const table = screen.getByRole('table', { name: 'Recent games' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Opponent', 'Moves']);
    for (const header of headers)
      expect(header).toHaveAttribute('scope', 'col');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(
      within(nth(rows, 1))
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['Ada', '34']);
    expect(headers[1]?.className).toMatch(/\btext-end\b/);
    expect(screen.getByTestId('games-g2').textContent).toBe('Grace51');
    // Not pressable: rows are not tab stops.
    expect(rows[1]).not.toHaveAttribute('tabindex');
  });

  test('wide: pressable rows answer click, Enter and Space', async () => {
    const user = userEvent.setup();
    const onRowPress = mock((_id: string) => undefined);
    renderUi(() => (
      <Table
        columns={COLUMNS}
        rows={GAMES}
        rowKey={(g) => g.id}
        onRowPress={(g) => onRowPress(g.id)}
        rowLabel={(g) => `Open game against ${g.opponent}`}
      />
    ));
    const ada = screen.getByRole('row', { name: 'Open game against Ada' });
    expect(ada).toHaveAttribute('tabindex', '0');
    await user.click(ada);
    expect(document.activeElement).toBe(ada);
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('row', { name: 'Open game against Grace' })
    );
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onRowPress.mock.calls.map(([id]) => id)).toEqual(['g1', 'g2', 'g2']);
  });

  test('compact: each row is a list item of label / value pairs', async () => {
    const user = userEvent.setup();
    const onRowPress = mock((_id: string) => undefined);
    renderUi(
      () => (
        <Table
          caption="Recent games"
          columns={COLUMNS}
          rows={GAMES}
          rowKey={(g) => g.id}
          onRowPress={(g) => onRowPress(g.id)}
          rowLabel={(g) => `Open game against ${g.opponent}`}
        />
      ),
      { width: 390 }
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(mustQuery('[data-component="Table"]')).toHaveAttribute(
      'data-layout',
      'compact'
    );
    const list = screen.getByRole('list', { name: 'Recent games' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const terms = within(nth(items, 0)).getAllByRole('term');
    expect(terms.map((t) => t.textContent)).toEqual(['Opponent', 'Moves']);
    const row = screen.getByRole('button', { name: 'Open game against Grace' });
    row.focus();
    await user.keyboard('{Enter}');
    expect(onRowPress).toHaveBeenCalledWith('g2');
  });

  test('wide: a sortable header orders the rows and flips on a second press', async () => {
    const user = userEvent.setup();
    renderUi(() => (
      <Table
        columns={COLUMNS.map((column) => ({
          ...column,
          sortValue: (g: Game) =>
            column.key === 'moves' ? g.moves : g.opponent,
        }))}
        rows={[...GAMES, { id: 'g3', opponent: 'Linus', moves: 40 }]}
        rowKey={(g) => g.id}
        defaultSort={{ key: 'moves', direction: 'descending' }}
      />
    ));
    const names = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    const moves = screen.getByRole('columnheader', { name: 'Moves' });
    expect(moves).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['Grace', 'Linus', 'Ada']);
    await user.click(within(moves).getByRole('button', { name: 'Moves' }));
    expect(moves).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Ada', 'Linus', 'Grace']);
    const opponent = screen.getByRole('columnheader', { name: 'Opponent' });
    await user.click(within(opponent).getByRole('button'));
    expect(opponent).toHaveAttribute('aria-sort', 'ascending');
    expect(moves).toHaveAttribute('aria-sort', 'none');
    expect(names()).toEqual(['Ada', 'Grace', 'Linus']);
  });

  test('compact: the primary column heads each card and sort is offered as chips', async () => {
    const user = userEvent.setup();
    renderUi(
      () => (
        <Table
          label="Games"
          columns={[
            {
              ...nth(COLUMNS, 0),
              primary: true,
              sortValue: (g: Game) => g.opponent,
            },
            { ...nth(COLUMNS, 1), sortValue: (g: Game) => g.moves },
          ]}
          rows={GAMES}
          rowKey={(g) => g.id}
          defaultSort={{ key: 'opponent', direction: 'ascending' }}
          testId="games"
        />
      ),
      { width: 390 }
    );
    const list = screen.getByRole('list', { name: 'Games' });
    const first = nth(within(list).getAllByRole('listitem'), 0);
    // The primary column is the card's heading, not a label / value pair.
    expect(
      within(first)
        .getAllByRole('term')
        .map((t) => t.textContent)
    ).toEqual(['Moves']);
    expect(first.textContent.startsWith('Ada')).toBe(true);
    expect(first).not.toHaveAttribute('data-pressable');
    await user.click(screen.getByRole('radio', { name: 'Moves' }));
    await user.click(screen.getByRole('button', { name: 'Sort descending' }));
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.dataset['testid'])).toEqual([
      'games-g2',
      'games-g1',
    ]);
  });

  test('pressable rows say so on the row, for both layouts', () => {
    renderUi(() => (
      <Table
        columns={COLUMNS}
        rows={GAMES}
        rowKey={(g) => g.id}
        onRowPress={() => undefined}
        testId="games"
      />
    ));
    expect(screen.getByTestId('games-g1')).toHaveAttribute(
      'data-pressable',
      'true'
    );
  });

  test('the empty slot replaces the rows', () => {
    renderUi(() => (
      <Table
        columns={COLUMNS}
        rows={[]}
        rowKey={(g) => g.id}
        empty={<p>{'No games yet'}</p>}
      />
    ));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('No games yet')).toBeTruthy();
  });
});
